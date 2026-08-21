"""
Passo 4 — API FastAPI.

Junta os três passos numa API que o front (Next.js) vai chamar.

Endpoints:
  GET  /saude      -> checa se a API está no ar
  POST /analisar   -> recebe a foto, devolve escala (GSD), cobertura e avisos.
                      O front usa isso pra mostrar a foto e validar antes de
                      o usuário marcar o terreno.
  POST /medir      -> recebe a foto + os pontos do polígono, devolve a área.

Rodar em desenvolvimento:
    uvicorn app.main:app --reload
Depois abra http://localhost:8000/docs pra testar pelo navegador.
"""
from __future__ import annotations

import json
import math
import mimetypes
import os
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel

load_dotenv()  # lê o .env local (GEMINI_API_KEY) antes de qualquer coisa

from app import db
from app.metadata import read_photo_metadata, PhotoMetadata
from app.gsd import compute_gsd
from app.area import area_do_poligono
from app.ia_projeto import (
    ETAPAS_EVOLUCAO,
    EXTENSAO_DURACAO_MAXIMA_S,
    GeracaoError,
    descricao_da_etapa,
    estender_video_projeto,
    gerar_imagem_projeto,
    gerar_video_projeto,
)
from app.jobs import Job, JobStatus, criar_job, obter_job
from app.auth import credenciais_validas

app = FastAPI(title="Medição de Terreno API", version="0.1.0")
db.init_db()

# libera o front (em produção, troque "*" pelo domínio do seu app)
origens_permitidas = [
    origem.strip()
    for origem in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    if origem.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origens_permitidas,
    allow_methods=["*"],
    allow_headers=["*"],
)

DISCLAIMER = ("Estimativa a partir de foto aérea. "
              "Não substitui levantamento topográfico oficial.")

UPLOADS_DIR = Path(
    os.getenv("MEDICAO_UPLOADS_DIR")
    or Path(__file__).resolve().parent.parent / "uploads"
)
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


class LoginDados(BaseModel):
    email: str
    senha: str


@app.post("/auth/login")
def login(dados: LoginDados):
    """Confere as credenciais informadas na tela de login."""
    if not credenciais_validas(dados.email, dados.senha):
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")
    return {"ok": True}


def _extensao_por_mime(mime: str | None, padrao: str) -> str:
    return {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "video/mp4": ".mp4",
    }.get(mime or "", padrao)


def _salvar_arquivo_projeto(job_id: str, tipo: str, dados: bytes, mime: str | None) -> Path:
    """Mantém imagens e vídeos gerados disponíveis mesmo após reiniciar a API."""
    padrao = ".mp4" if tipo == "video" else ".jpg"
    extensao = _extensao_por_mime(mime, padrao)
    for anterior in UPLOADS_DIR.glob(f"{tipo}-{job_id}.*"):
        anterior.unlink(missing_ok=True)
    caminho = UPLOADS_DIR / f"{tipo}-{job_id}{extensao}"
    caminho.write_bytes(dados)
    return caminho


def _arquivo_projeto(job_id: str, tipo: str) -> Path | None:
    return next(iter(UPLOADS_DIR.glob(f"{tipo}-{job_id}.*")), None)


def _salvar_foto(id_: str, foto: UploadFile, dados: bytes) -> None:
    sufixo = Path(foto.filename or "foto.jpg").suffix or ".jpg"
    (UPLOADS_DIR / f"{id_}{sufixo}").write_bytes(dados)


# ----------------------------------------------------------------------
# modelos de resposta
# ----------------------------------------------------------------------
class Analise(BaseModel):
    modelo_camera: str | None
    altura_voo_m: float | None
    gsd_cm_por_px: float
    cobertura_m: dict            # {"largura": x, "altura": y}
    cobertura_hectares: float
    avisos: list[str]
    disclaimer: str = DISCLAIMER


class Medicao(BaseModel):
    area_m2: float
    area_hectares: float
    perimetro_m: float
    resumo: str
    gsd_cm_por_px: float
    avisos: list[str]
    disclaimer: str = DISCLAIMER


class ProjetoStatus(BaseModel):
    job_id: str
    status: str
    erro: str | None = None
    duracao_total_s: int = 0
    pode_estender: bool = False


class EtapaStatus(BaseModel):
    etapa: str
    rotulo: str
    job_id: str
    status: str
    erro: str | None = None
    duracao_total_s: int = 0
    pode_estender: bool = False


class EvolucaoStatus(BaseModel):
    grupo_id: str
    etapas: list[EtapaStatus]


class Atividade(BaseModel):
    tipo: str          # "terreno" | "video"
    criado_em: str
    titulo: str
    detalhe: str


class PainelResumo(BaseModel):
    total_terrenos: int
    area_total_ha: float
    total_videos: int
    videos_processando: int
    terrenos_7dias: int
    medicoes_por_dia: dict[str, int]
    atividades: list[Atividade]


class Terreno(BaseModel):
    id: str
    criado_em: str
    nome_foto: str | None
    nome: str | None
    area_m2: float
    area_ha: float
    perimetro_m: float
    gsd_cm_por_px: float


class JobResumo(BaseModel):
    id: str
    criado_em: str
    atualizado_em: str
    status: str
    descricao: str | None
    erro: str | None

class TerrenoUpdate(BaseModel):
    nome: str | None = None



# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------
def _ler_metadado(upload: UploadFile) -> PhotoMetadata:
    """Salva o upload num arquivo temporário e lê o metadado dele."""
    sufixo = Path(upload.filename or "foto.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=sufixo) as tmp:
        tmp.write(upload.file.read())
        caminho = Path(tmp.name)
    try:
        return read_photo_metadata(caminho)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    finally:
        caminho.unlink(missing_ok=True)


def _avisos(md: PhotoMetadata) -> list[str]:
    avisos = []
    if md.gimbal_pitch_deg is None:
        avisos.append("Não achei a inclinação da câmera no metadado — "
                      "confirme que a foto foi tirada reta pra baixo.")
    elif not md.is_nadir():
        avisos.append(f"A câmera não estava reta pra baixo "
                      f"(inclinação {md.gimbal_pitch_deg:.0f}°, ideal -90°). "
                      f"A medição pode sair distorcida.")
    return avisos


# ----------------------------------------------------------------------
# endpoints
# ----------------------------------------------------------------------
@app.get("/saude")
def saude():
    return {"status": "ok"}


@app.post("/analisar", response_model=Analise)
def analisar(foto: UploadFile = File(...)):
    md = _ler_metadado(foto)

    faltando = md.missing_for_gsd()
    if faltando:
        raise HTTPException(
            status_code=422,
            detail=f"A foto não tem os dados necessários: {', '.join(faltando)}. "
                   f"Use uma foto original do drone (sem edição/recorte).",
        )

    g = compute_gsd(md)
    return Analise(
        modelo_camera=md.model,
        altura_voo_m=md.relative_altitude_m,
        gsd_cm_por_px=round(g.gsd_cm_per_px, 2),
        cobertura_m={"largura": round(g.ground_width_m, 1),
                     "altura": round(g.ground_height_m, 1)},
        cobertura_hectares=round(g.ground_area_m2 / 10_000, 3),
        avisos=_avisos(md),
    )


@app.post("/medir", response_model=Medicao)
def medir(
    foto: UploadFile = File(...),
    pontos: str = Form(..., description='Pontos do polígono em pixels, ex: [[10,20],[500,30],[480,600]]'),
    nome: str | None = Form(None, description='Nome/local do terreno, ex: "Sítio da esquina"'),
):
    # 1) lê o metadado e calcula a escala
    md = _ler_metadado(foto)
    if md.missing_for_gsd():
        raise HTTPException(status_code=422,
                            detail="Foto sem altitude/dados de câmera no metadado.")
    g = compute_gsd(md)

    # 2) valida os pontos recebidos
    try:
        lista = json.loads(pontos)
        pontos_px = [(float(p[0]), float(p[1])) for p in lista]
    except (json.JSONDecodeError, TypeError, ValueError, IndexError):
        raise HTTPException(status_code=400,
                            detail='"pontos" deve ser um JSON como [[x,y],[x,y],...]')

    # 3) calcula a área
    try:
        r = area_do_poligono(pontos_px, g.gsd_m_per_px)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    id_ = uuid.uuid4().hex
    foto.file.seek(0)
    _salvar_foto(id_, foto, foto.file.read())

    db.salvar_terreno(
        id_, foto.filename, r.area_m2, r.area_ha, r.perimeter_m,
        round(g.gsd_cm_per_px, 2), nome=nome,
    )

    return Medicao(
        area_m2=round(r.area_m2, 1),
        area_hectares=round(r.area_ha, 3),
        perimetro_m=round(r.perimeter_m, 1),
        resumo=r.resumo(),
        gsd_cm_por_px=round(g.gsd_cm_per_px, 2),
        avisos=_avisos(md),
    )


@app.post("/medir-manual", response_model=Medicao)
def medir_manual(
    foto: UploadFile = File(...),
    pontos: str = Form(..., description='Pontos do polígono em pixels, ex: [[10,20],[500,30],[480,600]]'),
    referencia: str = Form(..., description='Dois pontos em pixels marcando uma distância conhecida, ex: [[10,20],[210,20]]'),
    distancia_referencia_m: float = Form(..., description='Distância real, em metros, entre os dois pontos de referência'),
    nome: str | None = Form(None, description='Nome/local do terreno, ex: "Sítio da esquina"'),
):
    """
    Mede a área sem depender de metadado da foto (EXIF/XMP) — pra fotos
    de drones que não gravam esses dados (ex: drones sem GPS/barômetro,
    ou fotos que são na verdade um frame do vídeo ao vivo do app).

    Em vez da altitude, o usuário marca dois pontos na foto cuja distância
    real ele já sabe (ex: a largura de um muro medida com trena), e a
    escala (GSD) é calculada a partir disso.
    """
    if distancia_referencia_m <= 0:
        raise HTTPException(status_code=400, detail="a distância de referência precisa ser maior que zero")

    try:
        ref = json.loads(referencia)
        (rx1, ry1), (rx2, ry2) = [(float(p[0]), float(p[1])) for p in ref]
    except (json.JSONDecodeError, TypeError, ValueError, IndexError):
        raise HTTPException(status_code=400,
                            detail='"referencia" deve ser um JSON com 2 pontos, ex: [[10,20],[210,20]]')

    dist_px = ((rx2 - rx1) ** 2 + (ry2 - ry1) ** 2) ** 0.5
    if dist_px <= 0:
        raise HTTPException(status_code=400, detail="os dois pontos de referência estão no mesmo lugar")
    gsd_m_per_px = distancia_referencia_m / dist_px

    try:
        lista = json.loads(pontos)
        pontos_px = [(float(p[0]), float(p[1])) for p in lista]
    except (json.JSONDecodeError, TypeError, ValueError, IndexError):
        raise HTTPException(status_code=400,
                            detail='"pontos" deve ser um JSON como [[x,y],[x,y],...]')

    try:
        r = area_do_poligono(pontos_px, gsd_m_per_px)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    id_ = uuid.uuid4().hex
    _salvar_foto(id_, foto, foto.file.read())

    db.salvar_terreno(
        id_, foto.filename, r.area_m2, r.area_ha, r.perimeter_m,
        round(gsd_m_per_px * 100, 2), nome=nome,
    )

    return Medicao(
        area_m2=round(r.area_m2, 1),
        area_hectares=round(r.area_ha, 3),
        perimetro_m=round(r.perimeter_m, 1),
        resumo=r.resumo(),
        gsd_cm_por_px=round(gsd_m_per_px * 100, 2),
        avisos=["Medição manual — a precisão depende da distância de referência informada."],
    )


FOV_HORIZONTAL_PADRAO_DEG = 82.0  # chute razoável pra câmera grande-angular de drones pequenos


@app.post("/medir-altura", response_model=Medicao)
def medir_altura(
    foto: UploadFile = File(...),
    pontos: str = Form(..., description='Pontos do polígono em pixels, ex: [[10,20],[500,30],[480,600]]'),
    altura_voo_m: float = Form(..., description='Altura que o drone estava ao tirar a foto, em metros'),
    fov_horizontal_deg: float = Form(
        FOV_HORIZONTAL_PADRAO_DEG,
        description='Campo de visão horizontal da câmera, em graus (padrão: chute pra drone pequeno)',
    ),
    nome: str | None = Form(None, description='Nome/local do terreno, ex: "Sítio da esquina"'),
):
    """
    Mede a área a partir da altura de voo informada pelo usuário (lida na
    tela do app do drone durante o voo), pra drones que não gravam nenhum
    metadado técnico na foto. Usa um campo de visão (FOV) aproximado da
    câmera pra estimar a cobertura no chão — menos preciso que o método
    automático (que usa o foco real da câmera), mas não exige marcar
    pontos de referência na foto.
    """
    if altura_voo_m <= 0:
        raise HTTPException(status_code=400, detail="a altura de voo precisa ser maior que zero")
    if not (10 <= fov_horizontal_deg <= 170):
        raise HTTPException(status_code=400, detail="campo de visão precisa estar entre 10 e 170 graus")

    dados_foto = foto.file.read()
    sufixo = Path(foto.filename or "foto.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=sufixo) as tmp:
        tmp.write(dados_foto)
        caminho = Path(tmp.name)
    try:
        with Image.open(caminho) as img:
            img = ImageOps.exif_transpose(img)
            largura_px = img.width
    except UnidentifiedImageError:
        raise HTTPException(status_code=422, detail="o arquivo enviado não é uma imagem válida")
    except OSError:
        raise HTTPException(status_code=422, detail="não consegui ler o arquivo — a foto pode estar corrompida")
    finally:
        caminho.unlink(missing_ok=True)

    largura_solo_m = 2 * altura_voo_m * math.tan(math.radians(fov_horizontal_deg) / 2)
    gsd_m_per_px = largura_solo_m / largura_px

    try:
        lista = json.loads(pontos)
        pontos_px = [(float(p[0]), float(p[1])) for p in lista]
    except (json.JSONDecodeError, TypeError, ValueError, IndexError):
        raise HTTPException(status_code=400,
                            detail='"pontos" deve ser um JSON como [[x,y],[x,y],...]')

    try:
        r = area_do_poligono(pontos_px, gsd_m_per_px)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    id_ = uuid.uuid4().hex
    _salvar_foto(id_, foto, dados_foto)

    db.salvar_terreno(
        id_, foto.filename, r.area_m2, r.area_ha, r.perimeter_m,
        round(gsd_m_per_px * 100, 2), nome=nome,
    )

    aviso_fov = (
        "Área estimada a partir da altura de voo informada e de um campo de visão "
        "aproximado da câmera — pode ter mais erro que a medição automática ou por "
        "referência de distância."
    )
    return Medicao(
        area_m2=round(r.area_m2, 1),
        area_hectares=round(r.area_ha, 3),
        perimetro_m=round(r.perimeter_m, 1),
        resumo=r.resumo(),
        gsd_cm_por_px=round(gsd_m_per_px * 100, 2),
        avisos=[aviso_fov],
    )


# ----------------------------------------------------------------------
# geração de projeto por IA (foto do terreno -> imagem editada -> vídeo)
# ----------------------------------------------------------------------
def _status_do_job(job: Job) -> ProjetoStatus:
    pode_estender = (
        job.status == JobStatus.PRONTO
        and job.video_obj is not None
        and job.duracao_total_s < EXTENSAO_DURACAO_MAXIMA_S
    )
    return ProjetoStatus(
        job_id=job.id,
        status=job.status.value,
        erro=job.erro,
        duracao_total_s=job.duracao_total_s,
        pode_estender=pode_estender,
    )


def _rodar_geracao(job: Job, foto_bytes: bytes, foto_mime: str, descricao: str,
                    referencia_bytes: bytes | None = None, referencia_mime: str | None = None):
    try:
        job.descricao = descricao
        imagem_bytes, imagem_mime = gerar_imagem_projeto(
            foto_bytes, foto_mime, descricao, referencia_bytes, referencia_mime
        )
        job.imagem_bytes, job.imagem_mime = imagem_bytes, imagem_mime
        _salvar_arquivo_projeto(job.id, "imagem", imagem_bytes, imagem_mime)

        video_bytes, video_mime, video_obj = gerar_video_projeto(imagem_bytes, imagem_mime, descricao)
        job.video_bytes, job.video_mime, job.video_obj = video_bytes, video_mime, video_obj
        _salvar_arquivo_projeto(job.id, "video", video_bytes, video_mime)
        job.duracao_total_s = job.duracao_total_s or 8

        job.status = JobStatus.PRONTO
        db.atualizar_status_job(job.id, job.status.value)
    except GeracaoError as e:
        job.status = JobStatus.ERRO
        job.erro = str(e)
        db.atualizar_status_job(job.id, job.status.value, job.erro)
    except Exception as e:
        job.status = JobStatus.ERRO
        job.erro = f"erro inesperado ao gerar o projeto: {e}"
        db.atualizar_status_job(job.id, job.status.value, job.erro)


def _rodar_extensao(job: Job):
    try:
        video_bytes, video_mime, video_obj = estender_video_projeto(job.video_obj, job.descricao or "")
        job.video_bytes, job.video_mime, job.video_obj = video_bytes, video_mime, video_obj
        _salvar_arquivo_projeto(job.id, "video", video_bytes, video_mime)
        job.duracao_total_s += 7

        job.status = JobStatus.PRONTO
        db.atualizar_status_job(job.id, job.status.value)
    except GeracaoError as e:
        job.status = JobStatus.ERRO
        job.erro = str(e)
        db.atualizar_status_job(job.id, job.status.value, job.erro)
    except Exception as e:
        job.status = JobStatus.ERRO
        job.erro = f"erro inesperado ao estender o vídeo: {e}"
        db.atualizar_status_job(job.id, job.status.value, job.erro)


@app.post("/gerar-projeto", response_model=ProjetoStatus)
def gerar_projeto(
    background_tasks: BackgroundTasks,
    foto: UploadFile = File(...),
    descricao: str = Form(..., description='O que construir, ex: "casa térrea com piscina"'),
    referencia: UploadFile | None = File(
        None, description="Foto opcional de uma casa pronta, usada como referência de estilo"
    ),
):
    """
    Recebe a foto do terreno + a descrição do projeto e começa a geração
    em segundo plano (leva alguns minutos). Devolve um job_id — use
    GET /gerar-projeto/{job_id} pra acompanhar o andamento.
    """
    foto_bytes = foto.file.read()
    if not foto_bytes:
        raise HTTPException(status_code=400, detail="a foto enviada está vazia")
    if not descricao.strip():
        raise HTTPException(status_code=400, detail="descreva o que você quer construir")

    referencia_bytes = referencia.file.read() if referencia else None
    referencia_mime = referencia.content_type if referencia else None

    job = criar_job()
    db.registrar_job(job.id, descricao)
    background_tasks.add_task(
        _rodar_geracao, job, foto_bytes, foto.content_type or "image/jpeg", descricao,
        referencia_bytes, referencia_mime,
    )
    return _status_do_job(job)


@app.get("/gerar-projeto/{job_id}", response_model=ProjetoStatus)
def status_projeto(job_id: str):
    job = obter_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job não encontrado")
    return _status_do_job(job)


@app.post("/gerar-projeto/{job_id}/estender", response_model=ProjetoStatus)
def estender_projeto(job_id: str, background_tasks: BackgroundTasks):
    """
    Estende o vídeo desse job em +7s (recurso nativo do Veo 3.1), até o
    limite de 148s. Pode ser chamado de novo depois que o status voltar
    pra "pronto", pra continuar estendendo.
    """
    job = obter_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job não encontrado")
    if job.status != JobStatus.PRONTO:
        raise HTTPException(status_code=400, detail="o vídeo ainda não está pronto")
    if job.video_obj is None:
        raise HTTPException(
            status_code=400,
            detail="esse vídeo foi gerado antes desse recurso existir e não pode ser estendido",
        )
    if job.duracao_total_s >= EXTENSAO_DURACAO_MAXIMA_S:
        raise HTTPException(
            status_code=400,
            detail=f"limite máximo de extensão ({EXTENSAO_DURACAO_MAXIMA_S}s) atingido",
        )

    job.status = JobStatus.PROCESSANDO
    db.atualizar_status_job(job.id, job.status.value)
    background_tasks.add_task(_rodar_extensao, job)
    return _status_do_job(job)


@app.get("/gerar-projeto/{job_id}/imagem")
def imagem_projeto(job_id: str):
    job = obter_job(job_id)
    if job is None or job.imagem_bytes is None:
        raise HTTPException(status_code=404, detail="imagem ainda não disponível")
    return Response(content=job.imagem_bytes, media_type=job.imagem_mime)


@app.get("/gerar-projeto/{job_id}/video")
def video_projeto(job_id: str):
    job = obter_job(job_id)
    if job is None or job.video_bytes is None:
        raise HTTPException(status_code=404, detail="vídeo ainda não disponível")
    return Response(content=job.video_bytes, media_type=job.video_mime)


@app.get("/gerar-projeto/{job_id}/video/download")
def baixar_video_projeto(job_id: str):
    """Força o navegador a salvar o vídeo gerado como arquivo MP4."""
    job = obter_job(job_id)
    if job is None or job.video_bytes is None:
        raise HTTPException(status_code=404, detail="vídeo ainda não disponível")
    return Response(
        content=job.video_bytes,
        media_type=job.video_mime or "video/mp4",
        headers={"Content-Disposition": f'attachment; filename="projeto-{job_id[:8]}.mp4"'},
    )


@app.get("/videos-salvos/{job_id}/imagem")
def imagem_salva(job_id: str):
    caminho = _arquivo_projeto(job_id, "imagem")
    if caminho is None:
        raise HTTPException(status_code=404, detail="imagem salva não encontrada")
    mime = mimetypes.guess_type(caminho.name)[0] or "image/jpeg"
    return Response(content=caminho.read_bytes(), media_type=mime)


@app.get("/videos-salvos/{job_id}/video")
def video_salvo(job_id: str):
    caminho = _arquivo_projeto(job_id, "video")
    if caminho is None:
        raise HTTPException(status_code=404, detail="vídeo salvo não encontrado")
    mime = mimetypes.guess_type(caminho.name)[0] or "video/mp4"
    return Response(content=caminho.read_bytes(), media_type=mime)


@app.get("/videos-salvos/{job_id}/download")
def baixar_video_salvo(job_id: str):
    caminho = _arquivo_projeto(job_id, "video")
    if caminho is None:
        raise HTTPException(status_code=404, detail="vídeo salvo não encontrado")
    mime = mimetypes.guess_type(caminho.name)[0] or "video/mp4"
    return Response(
        content=caminho.read_bytes(),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="projeto-{job_id[:8]}.mp4"'},
    )


@app.post("/gerar-projeto-evolucao", response_model=EvolucaoStatus)
def gerar_projeto_evolucao(
    background_tasks: BackgroundTasks,
    foto: UploadFile = File(...),
    descricao: str = Form(..., description='Como a casa pronta deve ficar, ex: "casa térrea com piscina"'),
    referencia: UploadFile | None = File(
        None, description="Foto opcional de uma casa pronta, usada como referência de estilo"
    ),
):
    """
    Igual o /gerar-projeto, mas gera 4 vídeos curtos em vez de um só — um
    pra cada etapa da obra (fundação, estrutura, alvenaria/telhado,
    acabamento) — todos com a mesma descrição da casa, pra ficarem
    consistentes entre si. O usuário baixa os 4 e junta num editor de
    vídeo pra ter uma apresentação mais longa que os ~8s de um vídeo só.
    """
    foto_bytes = foto.file.read()
    if not foto_bytes:
        raise HTTPException(status_code=400, detail="a foto enviada está vazia")
    if not descricao.strip():
        raise HTTPException(status_code=400, detail="descreva o que você quer construir")

    referencia_bytes = referencia.file.read() if referencia else None
    referencia_mime = referencia.content_type if referencia else None

    grupo_id = uuid.uuid4().hex
    etapas: list[EtapaStatus] = []

    for chave, rotulo, sufixo in ETAPAS_EVOLUCAO:
        descricao_etapa = descricao_da_etapa(descricao, sufixo)
        job = criar_job(grupo_id=grupo_id, etapa=chave)
        db.registrar_job(job.id, descricao_etapa, grupo_id=grupo_id, etapa=chave)
        background_tasks.add_task(
            _rodar_geracao, job, foto_bytes, foto.content_type or "image/jpeg", descricao_etapa,
            referencia_bytes, referencia_mime,
        )
        etapas.append(EtapaStatus(etapa=chave, rotulo=rotulo, job_id=job.id, status=job.status.value))

    return EvolucaoStatus(grupo_id=grupo_id, etapas=etapas)


@app.get("/gerar-projeto-evolucao/{grupo_id}", response_model=EvolucaoStatus)
def status_evolucao(grupo_id: str):
    linhas = db.listar_jobs_do_grupo(grupo_id)
    if not linhas:
        raise HTTPException(status_code=404, detail="grupo não encontrado")

    rotulos = {chave: rotulo for chave, rotulo, _ in ETAPAS_EVOLUCAO}
    etapas = []
    for linha in linhas:
        job = obter_job(linha["id"])
        status_job = _status_do_job(job) if job else None
        etapas.append(EtapaStatus(
            etapa=linha["etapa"] or "",
            rotulo=rotulos.get(linha["etapa"], linha["etapa"] or ""),
            job_id=linha["id"],
            status=(status_job.status if status_job else linha["status"]),
            erro=(status_job.erro if status_job else linha["erro"]),
            duracao_total_s=(status_job.duracao_total_s if status_job else 0),
            pode_estender=(status_job.pode_estender if status_job else False),
        ))

    return EvolucaoStatus(grupo_id=grupo_id, etapas=etapas)


# ----------------------------------------------------------------------
# listagens — pras páginas de Terrenos e Visualizações do front
# ----------------------------------------------------------------------
@app.get("/terrenos", response_model=list[Terreno])
def terrenos():
    return [Terreno(**dict(t)) for t in db.listar_terrenos()]


@app.get("/videos", response_model=list[JobResumo])
def videos():
    return [JobResumo(**dict(j)) for j in db.listar_jobs()]


@app.patch("/terrenos/{terreno_id}", response_model=Terreno)
def editar_terreno(terreno_id: str, dados: TerrenoUpdate):
    if not db.renomear_terreno(terreno_id, dados.nome):
        raise HTTPException(status_code=404, detail="terreno não encontrado")
    linha = next((t for t in db.listar_terrenos(1000) if t["id"] == terreno_id), None)
    return Terreno(**dict(linha))

@app.delete("/terrenos/{terreno_id}")
def apagar_terreno(terreno_id: str):
    if not db.excluir_terreno(terreno_id):
        raise HTTPException(status_code=404, detail="terreno não encontrado")
    for arquivo in UPLOADS_DIR.glob(f"{terreno_id}.*"):
        arquivo.unlink(missing_ok=True)
    return {"ok": True}


@app.get("/terrenos/{terreno_id}/foto")
def foto_terreno(terreno_id: str):
    candidatos = list(UPLOADS_DIR.glob(f"{terreno_id}.*"))
    if not candidatos:
        raise HTTPException(status_code=404, detail="foto não encontrada")
    caminho = candidatos[0]
    mime = mimetypes.guess_type(caminho.name)[0] or "image/jpeg"
    return Response(content=caminho.read_bytes(), media_type=mime)


# ----------------------------------------------------------------------
# painel — resumo pro dashboard do front
# ----------------------------------------------------------------------
@app.get("/painel/resumo", response_model=PainelResumo)
def painel_resumo():
    r = db.resumo()
    return PainelResumo(
        total_terrenos=r["total_terrenos"],
        area_total_ha=round(r["area_total_m2"] / 10_000, 3),
        total_videos=r["total_videos"],
        videos_processando=r["videos_processando"],
        terrenos_7dias=r["terrenos_7dias"],
        medicoes_por_dia=r["medicoes_por_dia"],
        atividades=[Atividade(**a) for a in db.atividades_recentes()],
    )
