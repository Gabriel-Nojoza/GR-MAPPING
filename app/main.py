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
import asyncio
import tempfile
import uuid
from datetime import date
from pathlib import Path

from dotenv import load_dotenv
from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel

load_dotenv()  # lê o .env local (GEMINI_API_KEY) antes de qualquer coisa

from app import db, ramos
from app.metadata import read_photo_metadata, PhotoMetadata, dados_foto_voo
from app import qr as leitor_qr
from app.gsd import compute_gsd
from app.area import area_do_poligono
from app.ia_projeto import (
    ETAPAS_EVOLUCAO,
    EXTENSAO_DURACAO_MAXIMA_S,
    GeracaoError,
    descricao_da_etapa,
    estender_video_projeto,
    gerar_imagem_projeto,
    gerar_video_local,
)
from app.jobs import Job, JobStatus, criar_job, obter_job
from app.auth import (
    _gerar_hash,
    autenticar,
    contexto_usuario,
    exigir_superadmin,
    garantir_usuarios_iniciais,
    gerar_token,
    ramo_do_contexto,
)
from app.evolution import EvolutionError, conectar as conectar_whatsapp, enviar_texto as enviar_whatsapp, status as status_whatsapp
from app.lembretes import processar_lembretes, rotina_diaria, texto_lembrete
from app.leads import pesquisar_leads

app = FastAPI(title="Medição de Terreno API", version="0.1.0")
db.init_db()
garantir_usuarios_iniciais()


@app.on_event("startup")
async def iniciar_rotina_cobrancas():
    asyncio.create_task(rotina_diaria())

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


class EmpresaDados(BaseModel):
    nome: str
    cnpj: str | None = None
    plano: str = "teste"
    ramo: str = "imobiliaria"
    responsavel_nome: str | None = None
    responsavel_email: str | None = None
    responsavel_senha: str | None = None


class UsuarioEmpresaDados(BaseModel):
    nome: str
    email: str
    senha: str
    empresa_id: str
    modelo_drone: str | None = None


class UsuarioEmpresaUpdate(BaseModel):
    nome: str
    email: str
    empresa_id: str
    senha: str | None = None
    modelo_drone: str | None = None


class BuscaLeadsDados(BaseModel):
    cidade: str
    segmento: str = "Imobiliárias"
    limite: int = 20


class ModeloMensagemLeadDados(BaseModel):
    titulo: str
    conteudo: str


class ContratoDados(BaseModel):
    numero: str | None = None
    contratante_nome: str
    contratante_doc: str | None = None
    contratante_endereco: str | None = None
    servico: str
    valor_centavos: int = 0
    forma_pagamento: str | None = None
    data_inicio: str | None = None
    prazo_meses: int | None = None
    observacoes: str | None = None
    status: str = "rascunho"


@app.post("/auth/login")
def login(dados: LoginDados):
    """Confere as credenciais informadas na tela de login."""
    usuario = autenticar(dados.email, dados.senha)
    if usuario is None:
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")
    # O front usa o perfil para direcionar cada pessoa à área correta.
    return {
        "ok": True,
        "token": gerar_token(usuario),
        "usuario": usuario,
    }


@app.get("/config/ramo")
def config_do_ramo(contexto: dict | None = Depends(contexto_usuario)):
    """Configuração do ramo da empresa do usuário logado (sidebar + campos de cliente)."""
    return ramos.config_ramo(ramo_do_contexto(contexto))


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
    total_clientes: int
    receitas_pagas_mes: float
    despesas_pagas_mes: float
    a_receber_mes: float
    a_pagar_mes: float


class Terreno(BaseModel):
    id: str
    criado_em: str
    nome_foto: str | None
    nome: str | None
    area_m2: float
    area_ha: float
    perimetro_m: float
    gsd_cm_por_px: float
    pontos: list[list[float]] = []


class JobResumo(BaseModel):
    id: str
    criado_em: str
    atualizado_em: str
    status: str
    descricao: str | None
    erro: str | None

class TerrenoUpdate(BaseModel):
    nome: str | None = None
    pontos: list[list[float]] | None = None


class LancamentoDados(BaseModel):
    tipo: str
    descricao: str
    categoria: str
    valor_centavos: int
    vencimento: str
    observacao: str | None = None


class LancamentoStatus(BaseModel):
    status: str


class ClienteDados(BaseModel):
    nome: str
    contato: str | None = None
    email: str | None = None
    whatsapp_cobranca_ativo: bool = False
    dados: dict = {}


class ClienteWhatsappDados(BaseModel):
    whatsapp_cobranca_ativo: bool


class RecursoEngDados(BaseModel):
    nome: str
    dados: dict = {}


class FrenteDados(BaseModel):
    obra_id: str
    nome: str
    geojson: dict | None = None
    extensao_prevista_m: float = 0


class VooDados(BaseModel):
    obra_id: str
    data: str
    turno: str
    observacao: str | None = None
    operador_id: str | None = None


class DeteccaoDados(BaseModel):
    maquina_id: str
    foto_id: str | None = None
    frente_id: str | None = None
    lat: float | None = None
    lon: float | None = None
    status_maquina: str | None = None


class ConsumoDados(BaseModel):
    obra_id: str
    data: str
    turno: str
    maquina_id: str
    horas: float = 0
    custo_hora_centavos: int = 0


class ImovelDados(BaseModel):
    titulo: str
    tipo: str
    endereco: str | None = None
    descricao: str | None = None
    valor_aluguel_centavos: int
    taxa_condominio_centavos: int = 0
    cliente_id: str | None = None
    dia_vencimento: int | None = None


class CobrancaDados(BaseModel):
    imovel_id: str
    competencia: str
    vencimento: str
    valor_centavos: int | None = None


class CobrancaStatus(BaseModel):
    status: str



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
        round(g.gsd_cm_per_px, 2), nome=nome, pontos_json=json.dumps(pontos_px),
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
        round(gsd_m_per_px * 100, 2), nome=nome, pontos_json=json.dumps(pontos_px),
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
        round(gsd_m_per_px * 100, 2), nome=nome, pontos_json=json.dumps(pontos_px),
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
                    referencia_bytes: bytes | None = None, referencia_mime: str | None = None,
                    fotos_adicionais: list[tuple[bytes, str]] | None = None):
    try:
        job.descricao = descricao
        imagem_bytes, imagem_mime = gerar_imagem_projeto(
            foto_bytes, foto_mime, descricao, referencia_bytes, referencia_mime, fotos_adicionais
        )
        job.imagem_bytes, job.imagem_mime = imagem_bytes, imagem_mime
        _salvar_arquivo_projeto(job.id, "imagem", imagem_bytes, imagem_mime)

        # Fluxo econômico: a IA gera a imagem e a VPS monta o MP4 com FFmpeg.
        video_bytes, video_mime = gerar_video_local(imagem_bytes, imagem_mime)
        video_obj = None
        job.video_bytes, job.video_mime = video_bytes, video_mime
        job.video_obj = video_obj
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
    fotos_adicionais: list[UploadFile] = File(
        [], description="Até três fotos extras do mesmo terreno, por outros ângulos"
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
    extras = [
        (arquivo.file.read(), arquivo.content_type or "image/jpeg")
        for arquivo in fotos_adicionais[:3]
    ]
    extras = [(bytes_foto, mime_foto) for bytes_foto, mime_foto in extras if bytes_foto]

    job = criar_job()
    db.registrar_job(job.id, descricao)
    background_tasks.add_task(
        _rodar_geracao, job, foto_bytes, foto.content_type or "image/jpeg", descricao,
        referencia_bytes, referencia_mime, extras,
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
def _resposta_terreno(linha) -> Terreno:
    dados = dict(linha)
    try:
        dados["pontos"] = json.loads(dados.pop("pontos_json", None) or "[]")
    except json.JSONDecodeError:
        dados["pontos"] = []
    return Terreno(**dados)


@app.get("/terrenos", response_model=list[Terreno])
def terrenos():
    return [_resposta_terreno(t) for t in db.listar_terrenos()]


@app.get("/videos", response_model=list[JobResumo])
def videos():
    return [JobResumo(**dict(j)) for j in db.listar_jobs()]


@app.patch("/terrenos/{terreno_id}", response_model=Terreno)
def editar_terreno(terreno_id: str, dados: TerrenoUpdate):
    if dados.pontos is not None:
        if len(dados.pontos) < 3 or any(len(ponto) != 2 for ponto in dados.pontos):
            raise HTTPException(status_code=400, detail="marque pelo menos 3 pontos válidos")
        if not db.salvar_pontos_terreno(terreno_id, json.dumps(dados.pontos)):
            raise HTTPException(status_code=404, detail="terreno não encontrado")
    if dados.nome is not None and not db.renomear_terreno(terreno_id, dados.nome):
        raise HTTPException(status_code=404, detail="terreno não encontrado")
    linha = next((t for t in db.listar_terrenos(1000) if t["id"] == terreno_id), None)
    return _resposta_terreno(linha)

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
        total_clientes=r["total_clientes"],
        receitas_pagas_mes=r["receitas_pagas_mes"],
        despesas_pagas_mes=r["despesas_pagas_mes"],
        a_receber_mes=r["a_receber_mes"],
        a_pagar_mes=r["a_pagar_mes"],
    )


# ----------------------------------------------------------------------
# financeiro
# ----------------------------------------------------------------------
def _lancamento_resposta(linha) -> dict:
    dados = dict(linha)
    dados["valor"] = dados.pop("valor_centavos") / 100
    if dados["status"] == "pendente" and dados["vencimento"] < date.today().isoformat():
        dados["status"] = "atrasado"
    return dados


@app.get("/financeiro")
def listar_financeiro(mes: str | None = None):
    return [_lancamento_resposta(linha) for linha in db.listar_lancamentos(mes)]


@app.get("/financeiro/resumo")
def resumo_financeiro(mes: str | None = None):
    linhas = [_lancamento_resposta(linha) for linha in db.listar_lancamentos(mes)]
    receitas_pagas = sum(item["valor"] for item in linhas if item["tipo"] == "receita" and item["status"] == "pago")
    despesas_pagas = sum(item["valor"] for item in linhas if item["tipo"] == "despesa" and item["status"] == "pago")
    receber = sum(item["valor"] for item in linhas if item["tipo"] == "receita" and item["status"] != "pago")
    pagar = sum(item["valor"] for item in linhas if item["tipo"] == "despesa" and item["status"] != "pago")
    atrasados = sum(item["valor"] for item in linhas if item["status"] == "atrasado")
    return {"receitas_pagas": receitas_pagas, "despesas_pagas": despesas_pagas, "saldo": receitas_pagas - despesas_pagas, "a_receber": receber, "a_pagar": pagar, "atrasados": atrasados}


@app.post("/financeiro")
def criar_financeiro(dados: LancamentoDados):
    if dados.tipo not in {"receita", "despesa"}:
        raise HTTPException(status_code=400, detail="tipo deve ser receita ou despesa")
    if not dados.descricao.strip() or not dados.categoria.strip() or dados.valor_centavos <= 0:
        raise HTTPException(status_code=400, detail="preencha descrição, categoria e um valor maior que zero")
    try:
        date.fromisoformat(dados.vencimento)
    except ValueError:
        raise HTTPException(status_code=400, detail="vencimento deve estar no formato AAAA-MM-DD")
    identificador = uuid.uuid4().hex
    db.criar_lancamento(identificador, dados.tipo, dados.descricao.strip(), dados.categoria.strip(), dados.valor_centavos, dados.vencimento, dados.observacao)
    return _lancamento_resposta(next(item for item in db.listar_lancamentos() if item["id"] == identificador))


@app.patch("/financeiro/{lancamento_id}/status")
def atualizar_financeiro(lancamento_id: str, dados: LancamentoStatus):
    if dados.status not in {"pendente", "pago"}:
        raise HTTPException(status_code=400, detail="status deve ser pendente ou pago")
    if not db.atualizar_status_lancamento(lancamento_id, dados.status, date.today().isoformat() if dados.status == "pago" else None):
        raise HTTPException(status_code=404, detail="lançamento não encontrado")
    return {"ok": True}


@app.delete("/financeiro/{lancamento_id}")
def excluir_financeiro(lancamento_id: str):
    if not db.excluir_lancamento(lancamento_id):
        raise HTTPException(status_code=404, detail="lançamento não encontrado")
    return {"ok": True}


# ----------------------------------------------------------------------
# clientes
# ----------------------------------------------------------------------
def _normalizar_whatsapp(numero: str | None) -> str | None:
    if not numero:
        return None
    digitos = "".join(caractere for caractere in numero if caractere.isdigit())
    if len(digitos) in {10, 11}:
        digitos = f"55{digitos}"
    if len(digitos) < 12 or len(digitos) > 13 or not digitos.startswith("55"):
        raise HTTPException(status_code=400, detail="informe um WhatsApp brasileiro válido, com DDD")
    return digitos


def _cliente_resposta(linha) -> dict:
    """Converte a linha do banco e desserializa os campos específicos do ramo."""
    dados = dict(linha)
    bruto = dados.pop("dados_json", None)
    try:
        dados["dados"] = json.loads(bruto) if bruto else {}
    except (TypeError, ValueError):
        dados["dados"] = {}
    return dados


def _escopo_clientes(contexto: dict | None) -> str | None:
    """Engenharia enxerga só os clientes da própria empresa; imobiliária mantém o comportamento atual."""
    if contexto and ramo_do_contexto(contexto) == "engenharia":
        return contexto.get("empresa_id")
    return None


@app.get("/clientes")
def listar_clientes(busca: str | None = None, contexto: dict | None = Depends(contexto_usuario)):
    return [_cliente_resposta(item) for item in db.listar_clientes(busca, _escopo_clientes(contexto))]


@app.post("/clientes")
def criar_cliente(dados: ClienteDados, contexto: dict | None = Depends(contexto_usuario)):
    if not dados.nome.strip():
        raise HTTPException(status_code=400, detail="informe o nome do cliente")
    contato = _normalizar_whatsapp(dados.contato) if dados.contato else None
    if dados.whatsapp_cobranca_ativo and not contato:
        raise HTTPException(status_code=400, detail="informe o WhatsApp para ativar lembretes de cobrança")

    ramo = ramo_do_contexto(contexto)
    permitidas = ramos.chaves_cliente_permitidas(ramo)
    extras = {k: v for k, v in (dados.dados or {}).items() if k in permitidas and v not in (None, "")}
    for campo in ramos.campos_cliente_obrigatorios(ramo):
        if not extras.get(campo["key"]):
            raise HTTPException(status_code=400, detail=f"informe {campo['label'].lower()}")
    dados_json = json.dumps(extras, ensure_ascii=False) if extras else None

    identificador = uuid.uuid4().hex
    empresa_id = contexto.get("empresa_id") if contexto and ramo == "engenharia" else None
    db.criar_cliente(
        identificador, dados.nome.strip(), contato,
        dados.email.strip() if dados.email else None,
        dados.whatsapp_cobranca_ativo, dados_json, empresa_id,
    )
    return next(_cliente_resposta(item) for item in db.listar_clientes() if item["id"] == identificador)


@app.patch("/clientes/{cliente_id}/whatsapp-cobranca")
def atualizar_whatsapp_cobranca(cliente_id: str, dados: ClienteWhatsappDados):
    cliente = next((item for item in db.listar_clientes() if item["id"] == cliente_id), None)
    if cliente is None:
        raise HTTPException(status_code=404, detail="cliente não encontrado")
    if dados.whatsapp_cobranca_ativo and not cliente["contato"]:
        raise HTTPException(status_code=400, detail="cadastre um WhatsApp válido no cliente antes de ativar os lembretes")
    db.atualizar_whatsapp_cobranca_cliente(cliente_id, dados.whatsapp_cobranca_ativo)
    return {"ok": True}


# ----------------------------------------------------------------------
# recursos do ramo engenharia (obras, equipamentos, materiais, medições, monitoramento)
# ----------------------------------------------------------------------
TIPOS_RECURSO_ENG = {"obra", "equipamento", "material", "medicao", "monitoramento", "custo", "trabalhador", "operador"}


def _empresa_do_contexto(contexto: dict | None) -> str | None:
    return contexto.get("empresa_id") if contexto else None


def _recurso_eng_resposta(linha) -> dict:
    linha = dict(linha)
    bruto = linha.pop("dados_json", None)
    try:
        dados = json.loads(bruto) if bruto else {}
    except (TypeError, ValueError):
        dados = {}
    return {
        "id": linha["id"],
        "criado_em": linha["criado_em"],
        "tipo": linha["tipo"],
        "nome": linha["nome"],
        "tem_foto": bool(linha.get("foto_nome")),
        "dados": dados,
    }


def _valida_tipo_recurso(tipo: str) -> str:
    if tipo not in TIPOS_RECURSO_ENG:
        raise HTTPException(status_code=404, detail="módulo não encontrado")
    return tipo


@app.get("/eng/recursos/{tipo}")
def listar_recursos_eng(tipo: str, busca: str | None = None,
                        contexto: dict | None = Depends(contexto_usuario)):
    _valida_tipo_recurso(tipo)
    return [_recurso_eng_resposta(item)
            for item in db.listar_recursos_eng(_empresa_do_contexto(contexto), tipo, busca)]


@app.post("/eng/recursos/{tipo}")
def criar_recurso_eng(tipo: str, dados: RecursoEngDados,
                      contexto: dict | None = Depends(contexto_usuario)):
    _valida_tipo_recurso(tipo)
    nome = (dados.nome or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="informe o nome / identificação do registro")
    extras = {k: v for k, v in (dados.dados or {}).items() if v not in (None, "")}
    dados_json = json.dumps(extras, ensure_ascii=False) if extras else None
    identificador = uuid.uuid4().hex
    db.criar_recurso_eng(identificador, _empresa_do_contexto(contexto), tipo, nome, dados_json)
    return _recurso_eng_resposta(db.obter_recurso_eng(identificador))


@app.post("/eng/recursos/{tipo}/{recurso_id}/foto")
def enviar_foto_recurso_eng(tipo: str, recurso_id: str, foto: UploadFile = File(...)):
    _valida_tipo_recurso(tipo)
    if db.obter_recurso_eng(recurso_id) is None:
        raise HTTPException(status_code=404, detail="registro não encontrado")
    if foto.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="envie uma imagem JPG, PNG ou WEBP")
    conteudo = foto.file.read()
    if not conteudo or len(conteudo) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="a imagem deve ter no máximo 12 MB")
    extensao = _extensao_por_mime(foto.content_type, ".jpg")
    for anterior in UPLOADS_DIR.glob(f"recurso-{recurso_id}.*"):
        anterior.unlink(missing_ok=True)
    (UPLOADS_DIR / f"recurso-{recurso_id}{extensao}").write_bytes(conteudo)
    db.atualizar_foto_recurso_eng(recurso_id, foto.filename or "imagem", foto.content_type)
    return {"ok": True}


@app.get("/eng/recursos/{tipo}/{recurso_id}/foto")
def foto_recurso_eng(tipo: str, recurso_id: str):
    _valida_tipo_recurso(tipo)
    recurso = db.obter_recurso_eng(recurso_id)
    caminho = next(iter(UPLOADS_DIR.glob(f"recurso-{recurso_id}.*")), None)
    if recurso is None or caminho is None:
        raise HTTPException(status_code=404, detail="imagem não encontrada")
    return Response(content=caminho.read_bytes(), media_type=recurso["foto_mime"] or "image/jpeg")


@app.delete("/eng/recursos/{tipo}/{recurso_id}")
def excluir_recurso_eng(tipo: str, recurso_id: str):
    _valida_tipo_recurso(tipo)
    if not db.excluir_recurso_eng(recurso_id):
        raise HTTPException(status_code=404, detail="registro não encontrado")
    for arquivo in UPLOADS_DIR.glob(f"recurso-{recurso_id}.*"):
        arquivo.unlink(missing_ok=True)
    return {"ok": True}


# ----------------------------------------------------------------------
# monitoramento de produtividade por voo de drone (ramo engenharia)
# ----------------------------------------------------------------------
_R_TERRA = 6_371_000.0  # metros


def _dist_m(lat1, lon1, lat2, lon2) -> float:
    """Distância aproximada entre dois pontos GPS, em metros (haversine)."""
    if None in (lat1, lon1, lat2, lon2):
        return 0.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _R_TERRA * math.asin(min(1.0, math.sqrt(a)))


def _linha_da_frente(geojson) -> list[tuple[float, float]]:
    """Extrai a lista de (lon, lat) de um GeoJSON LineString (ou Feature com LineString)."""
    if not geojson:
        return []
    try:
        geo = json.loads(geojson) if isinstance(geojson, str) else geojson
        if geo.get("type") == "Feature":
            geo = geo.get("geometry", {})
        if geo.get("type") == "LineString":
            return [(float(c[0]), float(c[1])) for c in geo.get("coordinates", [])]
    except (TypeError, ValueError, KeyError):
        pass
    return []


def _progressiva(coords: list[tuple[float, float]], lat: float | None, lon: float | None) -> float | None:
    """Posição (em metros do início) do ponto projetado sobre a linha da frente."""
    if not coords or lat is None or lon is None or len(coords) < 2:
        return None
    melhor_dist = float("inf")
    acumulado = 0.0
    progressiva = 0.0
    for (lon1, lat1), (lon2, lat2) in zip(coords, coords[1:]):
        seg_m = _dist_m(lat1, lon1, lat2, lon2)
        # projeta o ponto no segmento usando um plano local em metros
        ax, ay = 0.0, 0.0
        bx = _dist_m(lat1, lon1, lat1, lon2) * (1 if lon2 >= lon1 else -1)
        by = _dist_m(lat1, lon1, lat2, lon1) * (1 if lat2 >= lat1 else -1)
        px = _dist_m(lat1, lon1, lat1, lon) * (1 if lon >= lon1 else -1)
        py = _dist_m(lat1, lon1, lat, lon1) * (1 if lat >= lat1 else -1)
        seg2 = bx * bx + by * by
        t = 0.0 if seg2 == 0 else max(0.0, min(1.0, ((px - ax) * bx + (py - ay) * by) / seg2))
        cx, cy = ax + t * bx, ay + t * by
        d = math.hypot(px - cx, py - cy)
        if d < melhor_dist:
            melhor_dist = d
            progressiva = acumulado + t * seg_m
        acumulado += seg_m
    return round(progressiva, 1)


def _frente_da_obra(obra_id: str, frente_id: str | None):
    frentes = list(db.listar_frentes(obra_id))
    if frente_id:
        return next((f for f in frentes if f["id"] == frente_id), None)
    return frentes[0] if frentes else None


def _nome_do_contexto(contexto: dict | None) -> str | None:
    """Nome de quem está logado (pra registrar quem criou o voo / subiu as fotos)."""
    if not contexto or not contexto.get("email"):
        return None
    email = contexto["email"]
    usuario = db.obter_usuario_por_email(email)
    return (usuario["nome"] if usuario and usuario["nome"] else email)


def _operador_do_email(contexto: dict | None):
    """Acha o operador cadastrado cujo e-mail bate com o do usuário logado."""
    if not contexto or not contexto.get("email"):
        return None
    alvo = contexto["email"].strip().lower()
    for r in db.listar_recursos_eng(_empresa_do_contexto(contexto), "operador"):
        try:
            dados = json.loads(r["dados_json"]) if r["dados_json"] else {}
        except (TypeError, ValueError):
            dados = {}
        if (dados.get("email") or "").strip().lower() == alvo:
            return r
    return None


def _operador_info(operador_id):
    if not operador_id:
        return None, None
    r = db.obter_recurso_eng(operador_id)
    if not r:
        return None, None
    try:
        dados = json.loads(r["dados_json"]) if r["dados_json"] else {}
    except (TypeError, ValueError):
        dados = {}
    return r["nome"], dados.get("modelo_drone")


def _voo_resposta(linha) -> dict:
    d = dict(linha)
    fotos = db.listar_fotos_voo(d["id"])
    det = db.listar_deteccoes(d["id"])
    d["total_fotos"] = len(fotos)
    d["total_deteccoes"] = len(det)
    d["fotos_com_gps"] = sum(1 for f in fotos if f["gps_lat"] is not None)
    nome, drone = _operador_info(d.get("operador_id"))
    d["operador_nome"] = nome
    d["operador_drone"] = drone
    return d


@app.get("/eng/frentes")
def listar_frentes(obra_id: str):
    saida = []
    for f in db.listar_frentes(obra_id):
        item = dict(f)
        try:
            item["geojson"] = json.loads(item["geojson"]) if item["geojson"] else None
        except (TypeError, ValueError):
            item["geojson"] = None
        saida.append(item)
    return saida


@app.post("/eng/frentes")
def criar_frente(dados: FrenteDados, contexto: dict | None = Depends(contexto_usuario)):
    nome = dados.nome.strip()
    if not nome or not dados.obra_id:
        raise HTTPException(status_code=400, detail="informe a obra e o nome da frente")
    identificador = uuid.uuid4().hex
    geo = json.dumps(dados.geojson, ensure_ascii=False) if dados.geojson else None
    db.criar_frente(identificador, _empresa_do_contexto(contexto), dados.obra_id, nome, geo, max(0.0, dados.extensao_prevista_m))
    return dict(db.obter_frente(identificador))


@app.patch("/eng/frentes/{frente_id}")
def atualizar_frente(frente_id: str, dados: FrenteDados):
    if db.obter_frente(frente_id) is None:
        raise HTTPException(status_code=404, detail="frente não encontrada")
    geo = json.dumps(dados.geojson, ensure_ascii=False) if dados.geojson else None
    db.atualizar_frente(frente_id, dados.nome.strip(), geo, max(0.0, dados.extensao_prevista_m))
    return {"ok": True}


@app.delete("/eng/frentes/{frente_id}")
def excluir_frente(frente_id: str):
    if not db.excluir_frente(frente_id):
        raise HTTPException(status_code=404, detail="frente não encontrada")
    return {"ok": True}


@app.get("/eng/voos")
def listar_voos(obra_id: str | None = None, contexto: dict | None = Depends(contexto_usuario)):
    return [_voo_resposta(v) for v in db.listar_voos(_empresa_do_contexto(contexto), obra_id)]


@app.post("/eng/voos")
def criar_voo(dados: VooDados, contexto: dict | None = Depends(contexto_usuario)):
    if not dados.obra_id or not dados.data:
        raise HTTPException(status_code=400, detail="informe a obra e a data do voo")
    if dados.turno not in {"Manhã", "Tarde", "Único"}:
        raise HTTPException(status_code=400, detail="turno inválido")
    operador_id = dados.operador_id or None
    if not operador_id:
        achado = _operador_do_email(contexto)
        operador_id = achado["id"] if achado else None
    identificador = uuid.uuid4().hex
    db.criar_voo(identificador, _empresa_do_contexto(contexto), dados.obra_id, dados.data, dados.turno,
                 (dados.observacao or "").strip() or None, operador_id, _nome_do_contexto(contexto))
    return _voo_resposta(db.obter_voo(identificador))


@app.get("/eng/voos/{voo_id}")
def obter_voo(voo_id: str):
    voo = db.obter_voo(voo_id)
    if voo is None:
        raise HTTPException(status_code=404, detail="voo não encontrado")
    resultado = _voo_resposta(voo)
    fotos = [dict(f) for f in db.listar_fotos_voo(voo_id)]
    por_id = {f["id"]: f for f in fotos}
    deteccoes = []
    for d in db.listar_deteccoes(voo_id):
        d = dict(d)
        foto = por_id.get(d.get("foto_id"))
        d["foto_tirada_em"] = foto["tirada_em"] if foto else None
        deteccoes.append(d)
    resultado["fotos"] = fotos
    resultado["deteccoes"] = deteccoes
    return resultado


@app.delete("/eng/voos/{voo_id}")
def excluir_voo(voo_id: str):
    for f in db.listar_fotos_voo(voo_id):
        for arq in UPLOADS_DIR.glob(f"voo-{f['id']}.*"):
            arq.unlink(missing_ok=True)
    if not db.excluir_voo(voo_id):
        raise HTTPException(status_code=404, detail="voo não encontrado")
    return {"ok": True}


@app.post("/eng/voos/{voo_id}/fotos")
def enviar_fotos_voo(voo_id: str, fotos: list[UploadFile] = File(...),
                     contexto: dict | None = Depends(contexto_usuario)):
    voo = db.obter_voo(voo_id)
    if voo is None:
        raise HTTPException(status_code=404, detail="voo não encontrado")

    empresa_id = _empresa_do_contexto(contexto)
    maquinas_validas = {r["id"] for r in db.listar_recursos_eng(empresa_id, "equipamento")}
    frente = _frente_da_obra(voo["obra_id"], None)
    coords_frente = _linha_da_frente(frente["geojson"]) if frente else []
    ja_detectadas = {d["maquina_id"] for d in db.listar_deteccoes(voo_id) if d["metodo"] == "qr"}

    salvas, qrs_lidos = 0, 0
    for foto in fotos:
        if foto.content_type not in {"image/jpeg", "image/png", "image/webp"}:
            continue
        conteudo = foto.file.read()
        if not conteudo or len(conteudo) > 25 * 1024 * 1024:
            continue
        foto_id = uuid.uuid4().hex
        extensao = _extensao_por_mime(foto.content_type, ".jpg")
        caminho = UPLOADS_DIR / f"voo-{foto_id}{extensao}"
        caminho.write_bytes(conteudo)
        try:
            meta = dados_foto_voo(caminho)
        except Exception:
            meta = {"gps_lat": None, "gps_lon": None, "altitude_m": None, "tirada_em": None}
        db.adicionar_foto_voo(foto_id, voo_id, foto.filename or "foto.jpg", foto.content_type,
                              meta["gps_lat"], meta["gps_lon"], meta["altitude_m"], meta["tirada_em"])
        salvas += 1

        # leitura automática do QR (best-effort)
        try:
            achados = leitor_qr.ler_qrs(caminho)
        except Exception:
            achados = []
        if achados:
            db.marcar_foto_qr(foto_id)
        for item in achados:
            mid = leitor_qr.id_maquina(item["texto"])
            if not mid or mid not in maquinas_validas or mid in ja_detectadas:
                continue
            lat, lon = meta["gps_lat"], meta["gps_lon"]
            prog = _progressiva(coords_frente, lat, lon) if coords_frente else None
            db.criar_deteccao(uuid.uuid4().hex, voo_id, foto_id, mid,
                              frente["id"] if frente else None, lat, lon, prog, "qr", None)
            ja_detectadas.add(mid)
            qrs_lidos += 1

    return {"ok": True, "adicionadas": salvas, "qrs_lidos": qrs_lidos, "leitor_ativo": leitor_qr.disponivel()}


@app.get("/eng/voos/{voo_id}/fotos/{foto_id}/imagem")
def imagem_foto_voo(voo_id: str, foto_id: str):
    foto = db.obter_foto_voo(foto_id)
    caminho = next(iter(UPLOADS_DIR.glob(f"voo-{foto_id}.*")), None)
    if foto is None or caminho is None:
        raise HTTPException(status_code=404, detail="foto não encontrada")
    return Response(content=caminho.read_bytes(), media_type=foto["mime"] or "image/jpeg")


@app.post("/eng/voos/{voo_id}/deteccoes")
def criar_deteccao(voo_id: str, dados: DeteccaoDados):
    voo = db.obter_voo(voo_id)
    if voo is None:
        raise HTTPException(status_code=404, detail="voo não encontrado")
    if not dados.maquina_id:
        raise HTTPException(status_code=400, detail="informe a máquina")
    frente = _frente_da_obra(voo["obra_id"], dados.frente_id)
    progressiva = None
    if frente is not None:
        progressiva = _progressiva(_linha_da_frente(frente["geojson"]), dados.lat, dados.lon)
    identificador = uuid.uuid4().hex
    db.criar_deteccao(identificador, voo_id, dados.foto_id, dados.maquina_id,
                      frente["id"] if frente is not None else None,
                      dados.lat, dados.lon, progressiva, "manual", dados.status_maquina)
    return dict(db.obter_deteccao(identificador))


@app.patch("/eng/deteccoes/{deteccao_id}")
def atualizar_deteccao(deteccao_id: str, dados: DeteccaoDados):
    det = db.obter_deteccao(deteccao_id)
    if det is None:
        raise HTTPException(status_code=404, detail="detecção não encontrada")
    voo = db.obter_voo(det["voo_id"])
    frente = _frente_da_obra(voo["obra_id"], dados.frente_id or det["frente_id"])
    progressiva = _progressiva(_linha_da_frente(frente["geojson"]), dados.lat, dados.lon) if frente else None
    db.atualizar_deteccao(deteccao_id, dados.maquina_id, dados.lat, dados.lon, progressiva, dados.status_maquina)
    return {"ok": True}


@app.delete("/eng/deteccoes/{deteccao_id}")
def excluir_deteccao(deteccao_id: str):
    if not db.excluir_deteccao(deteccao_id):
        raise HTTPException(status_code=404, detail="detecção não encontrada")
    return {"ok": True}


@app.get("/eng/consumo")
def listar_consumo(obra_id: str, data: str | None = None, turno: str | None = None):
    return [dict(c) for c in db.listar_consumo(obra_id, data, turno)]


@app.post("/eng/consumo")
def salvar_consumo(dados: ConsumoDados, contexto: dict | None = Depends(contexto_usuario)):
    if not dados.obra_id or not dados.maquina_id or not dados.data:
        raise HTTPException(status_code=400, detail="informe obra, data e máquina")
    db.salvar_consumo(uuid.uuid4().hex, _empresa_do_contexto(contexto), dados.obra_id, dados.data,
                      dados.turno, dados.maquina_id, max(0.0, dados.horas), max(0, dados.custo_hora_centavos))
    return {"ok": True}


_ORDEM_TURNO = {"Manhã": 0, "Único": 1, "Tarde": 2}


def _avanco_entre_voos(voo_a_id: str, voo_b_id: str) -> dict:
    """Avanço (m) e nº de máquinas paradas entre dois voos, pela distância GPS."""
    det_a = {d["maquina_id"]: dict(d) for d in db.listar_deteccoes(voo_a_id)}
    det_b = {d["maquina_id"]: dict(d) for d in db.listar_deteccoes(voo_b_id)}
    total, paradas, ativas = 0.0, 0, 0
    for mid in set(det_a) & set(det_b):
        a, b = det_a[mid], det_b[mid]
        if None in (a.get("lat"), a.get("lon"), b.get("lat"), b.get("lon")):
            continue
        av = _dist_m(a["lat"], a["lon"], b["lat"], b["lon"])
        ativas += 1
        if av < 15:
            paradas += 1
        else:
            total += av
    return {"avanco_m": round(total, 1), "paradas": paradas, "maquinas": ativas}


@app.get("/eng/dashboard")
def eng_dashboard(contexto: dict | None = Depends(contexto_usuario)):
    empresa_id = _empresa_do_contexto(contexto)
    obras = [_recurso_eng_resposta(o) for o in db.listar_recursos_eng(empresa_id, "obra")]
    maquinas = list(db.listar_recursos_eng(empresa_id, "equipamento"))
    trabalhadores = list(db.listar_recursos_eng(empresa_id, "trabalhador"))
    operadores = list(db.listar_recursos_eng(empresa_id, "operador"))
    voos = list(db.listar_voos(empresa_id, None))
    obra_nome = {o["id"]: o["nome"] for o in obras}
    op_nome = {o["id"]: o["nome"] for o in operadores}

    # agrupa voos por (obra, data)
    grupos: dict[tuple, list] = {}
    for v in voos:
        grupos.setdefault((v["obra_id"], v["data"]), []).append(dict(v))

    dias, por_obra, calendario = [], {}, {}
    for (obra_id, data), lista in grupos.items():
        lista.sort(key=lambda v: _ORDEM_TURNO.get(v["turno"], 1))
        turnos = [v["turno"] for v in lista]
        quem = {op_nome.get(v.get("operador_id")) or v.get("criado_por") for v in lista}
        calendario[data] = calendario.get(data, [])
        calendario[data].append({"obra": obra_nome.get(obra_id, "Obra"), "turnos": turnos, "operadores": sorted(q for q in quem if q)})
        if len(lista) >= 2:
            r = _avanco_entre_voos(lista[0]["id"], lista[-1]["id"])
            dias.append({"obra": obra_nome.get(obra_id, "Obra"), "data": data, **r})
            por_obra[obra_id] = por_obra.get(obra_id, 0) + r["avanco_m"]

    dias.sort(key=lambda d: d["data"])
    mes_atual = date.today().strftime("%Y-%m")
    return {
        "obras_total": len(obras),
        "obras_em_andamento": sum(1 for o in obras if o["dados"].get("status") == "Em andamento"),
        "maquinas_total": len(maquinas),
        "trabalhadores_total": len(trabalhadores),
        "operadores_total": len(operadores),
        "voos_total": len(voos),
        "voos_mes": sum(1 for v in voos if v["data"].startswith(mes_atual)),
        "avanco_total_m": round(sum(d["avanco_m"] for d in dias), 1),
        "dias": dias,
        "por_obra": [{"obra": obra_nome.get(oid, "Obra"), "metros": round(m, 1)} for oid, m in por_obra.items()],
        "calendario": calendario,
    }


@app.get("/eng/obras/{obra_id}/comparar")
def comparar_voos(obra_id: str, voo_a: str, voo_b: str):
    """Avanço de cada máquina entre dois voos da mesma obra."""
    va, vb = db.obter_voo(voo_a), db.obter_voo(voo_b)
    if va is None or vb is None:
        raise HTTPException(status_code=404, detail="voo não encontrado")

    det_a = {d["maquina_id"]: dict(d) for d in db.listar_deteccoes(voo_a)}
    det_b = {d["maquina_id"]: dict(d) for d in db.listar_deteccoes(voo_b)}
    maquinas = {r["id"]: r["nome"] for r in db.listar_recursos_eng(None, "equipamento")}

    consumo = {c["maquina_id"]: dict(c) for c in db.listar_consumo(obra_id, vb["data"], vb["turno"])}

    linhas = []
    for mid in sorted(set(det_a) | set(det_b)):
        a, b = det_a.get(mid), det_b.get(mid)
        avanco = None
        if a and b:
            if a.get("progressiva_m") is not None and b.get("progressiva_m") is not None:
                avanco = round(b["progressiva_m"] - a["progressiva_m"], 1)
            elif None not in (a.get("lat"), a.get("lon"), b.get("lat"), b.get("lon")):
                avanco = round(_dist_m(a["lat"], a["lon"], b["lat"], b["lon"]), 1)
        parada = avanco is not None and abs(avanco) < 15
        cst = consumo.get(mid, {})
        horas = cst.get("horas") or 0
        custo = horas * (cst.get("custo_hora_centavos") or 0) / 100
        linhas.append({
            "maquina_id": mid,
            "maquina_nome": maquinas.get(mid, "Máquina"),
            "pos_a": a and {"lat": a["lat"], "lon": a["lon"], "progressiva_m": a.get("progressiva_m")},
            "pos_b": b and {"lat": b["lat"], "lon": b["lon"], "progressiva_m": b.get("progressiva_m")},
            "avanco_m": avanco,
            "parada": parada,
            "horas": horas,
            "custo": round(custo, 2),
            "custo_por_metro": round(custo / avanco, 2) if avanco and avanco > 0 else None,
        })

    avanco_total = sum(l["avanco_m"] for l in linhas if l["avanco_m"] and l["avanco_m"] > 0)
    custo_total = sum(l["custo"] for l in linhas)
    return {
        "voo_a": dict(va), "voo_b": dict(vb),
        "maquinas": linhas,
        "avanco_total_m": round(avanco_total, 1),
        "custo_total": round(custo_total, 2),
        "custo_por_metro": round(custo_total / avanco_total, 2) if avanco_total > 0 else None,
    }


def _contrato_resposta(linha) -> dict:
    d = dict(linha)
    d["valor"] = d.pop("valor_centavos", 0) / 100
    return d


@app.get("/admin/contratos")
def admin_listar_contratos(_: dict = Depends(exigir_superadmin)):
    return [_contrato_resposta(c) for c in db.listar_contratos()]


@app.post("/admin/contratos")
def admin_criar_contrato(dados: ContratoDados, _: dict = Depends(exigir_superadmin)):
    nome = dados.contratante_nome.strip()
    servico = dados.servico.strip()
    if not nome or not servico:
        raise HTTPException(status_code=400, detail="Informe o nome do contratante e o serviço.")
    identificador = uuid.uuid4().hex
    db.criar_contrato(
        identificador, (dados.numero or "").strip() or None, nome,
        (dados.contratante_doc or "").strip() or None, (dados.contratante_endereco or "").strip() or None,
        servico, max(0, dados.valor_centavos), (dados.forma_pagamento or "").strip() or None,
        (dados.data_inicio or "").strip() or None, dados.prazo_meses,
        (dados.observacoes or "").strip() or None, dados.status or "rascunho",
    )
    return _contrato_resposta(db.obter_contrato(identificador))


@app.patch("/admin/contratos/{contrato_id}")
def admin_atualizar_contrato(contrato_id: str, dados: ContratoDados, _: dict = Depends(exigir_superadmin)):
    if db.obter_contrato(contrato_id) is None:
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    db.atualizar_contrato(
        contrato_id, (dados.numero or "").strip() or None, dados.contratante_nome.strip(),
        (dados.contratante_doc or "").strip() or None, (dados.contratante_endereco or "").strip() or None,
        dados.servico.strip(), max(0, dados.valor_centavos), (dados.forma_pagamento or "").strip() or None,
        (dados.data_inicio or "").strip() or None, dados.prazo_meses,
        (dados.observacoes or "").strip() or None, dados.status or "rascunho",
    )
    return _contrato_resposta(db.obter_contrato(contrato_id))


@app.delete("/admin/contratos/{contrato_id}")
def admin_excluir_contrato(contrato_id: str, _: dict = Depends(exigir_superadmin)):
    if not db.excluir_contrato(contrato_id):
        raise HTTPException(status_code=404, detail="Contrato não encontrado.")
    return {"ok": True}


@app.get("/admin/empresas")
def admin_listar_empresas(_: dict = Depends(exigir_superadmin)):
    return [dict(empresa) for empresa in db.listar_empresas()]


@app.post("/admin/leads/pesquisar")
def admin_pesquisar_leads(dados: BuscaLeadsDados, _: dict = Depends(exigir_superadmin)):
    cidade = dados.cidade.strip()
    segmento = dados.segmento.strip() or "Imobiliárias"
    if len(cidade) < 2:
        raise HTTPException(status_code=400, detail="Informe uma cidade ou região para pesquisar.")
    return pesquisar_leads(cidade, segmento, dados.limite)


@app.get("/admin/leads/modelos")
def admin_listar_modelos_leads(_: dict = Depends(exigir_superadmin)):
    return [dict(item) for item in db.listar_modelos_mensagem_leads()]


@app.post("/admin/leads/modelos")
def admin_criar_modelo_lead(dados: ModeloMensagemLeadDados, _: dict = Depends(exigir_superadmin)):
    titulo, conteudo = dados.titulo.strip(), dados.conteudo.strip()
    if not titulo or not conteudo:
        raise HTTPException(status_code=400, detail="Informe o título e a mensagem do modelo.")
    identificador = uuid.uuid4().hex
    db.criar_modelo_mensagem_lead(identificador, titulo, conteudo)
    return next(dict(item) for item in db.listar_modelos_mensagem_leads() if item["id"] == identificador)


@app.delete("/admin/leads/modelos/{modelo_id}")
def admin_excluir_modelo_lead(modelo_id: str, _: dict = Depends(exigir_superadmin)):
    if not db.excluir_modelo_mensagem_lead(modelo_id):
        raise HTTPException(status_code=404, detail="Modelo não encontrado.")
    return {"ok": True}


@app.post("/admin/empresas")
def admin_criar_empresa(dados: EmpresaDados, _: dict = Depends(exigir_superadmin)):
    nome = dados.nome.strip()
    plano = dados.plano.strip().lower()
    ramo = (dados.ramo or "").strip().lower()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome da empresa.")
    if plano not in {"teste", "basico", "profissional", "premium"}:
        raise HTTPException(status_code=400, detail="Plano inválido.")
    if not ramos.ramo_valido(ramo):
        raise HTTPException(status_code=400, detail="Ramo de atuação inválido.")
    identificador = uuid.uuid4().hex
    campos_responsavel = (dados.responsavel_nome, dados.responsavel_email, dados.responsavel_senha)
    if any(campos_responsavel) and not all(campos_responsavel):
        raise HTTPException(status_code=400, detail="Preencha nome, e-mail e senha do responsável.")
    if all(campos_responsavel):
        email = (dados.responsavel_email or "").strip().lower()
        senha = dados.responsavel_senha or ""
        if "@" not in email or len(senha) < 8:
            raise HTTPException(status_code=400, detail="Informe e-mail válido e senha com pelo menos 8 caracteres.")
        if db.obter_usuario_por_email(email) is not None:
            raise HTTPException(status_code=409, detail="Este e-mail já está em uso por outro acesso. Use outro e-mail para o responsável.")
        db.criar_empresa_com_acesso(
            identificador, nome, dados.cnpj.strip() if dados.cnpj else None, plano,
            uuid.uuid4().hex, (dados.responsavel_nome or "").strip(), email, _gerar_hash(senha),
            ramo=ramo,
        )
    else:
        db.criar_empresa(identificador, nome, dados.cnpj.strip() if dados.cnpj else None, plano, ramo=ramo)
    return next(dict(empresa) for empresa in db.listar_empresas() if empresa["id"] == identificador)


@app.get("/admin/usuarios")
def admin_listar_usuarios(_: dict = Depends(exigir_superadmin)):
    """Lista acessos sem jamais devolver hashes de senha."""
    return [dict(usuario) for usuario in db.listar_usuarios()]


@app.post("/admin/usuarios")
def admin_criar_usuario(dados: UsuarioEmpresaDados, _: dict = Depends(exigir_superadmin)):
    email = dados.email.strip().lower()
    nome = dados.nome.strip()
    if not nome or "@" not in email:
        raise HTTPException(status_code=400, detail="Informe nome e e-mail válidos.")
    if len(dados.senha) < 8:
        raise HTTPException(status_code=400, detail="A senha precisa ter pelo menos 8 caracteres.")
    empresa = db.obter_empresa(dados.empresa_id)
    if empresa is None:
        raise HTTPException(status_code=400, detail="Empresa não encontrada.")
    db.criar_ou_atualizar_usuario(
        uuid.uuid4().hex, email, nome, _gerar_hash(dados.senha), "imobiliaria", dados.empresa_id
    )
    # empresa de engenharia com modelo de drone -> cria/atualiza o Operador
    if ramos.normalizar_ramo(empresa["ramo"]) == "engenharia" and (dados.modelo_drone or "").strip():
        _upsert_operador(dados.empresa_id, email, nome, dados.modelo_drone.strip())
    return next(dict(usuario) for usuario in db.listar_usuarios() if usuario["email"] == email)


def _upsert_operador(empresa_id: str, email: str, nome: str, modelo_drone: str) -> None:
    """Cria ou atualiza o cadastro de operador de drone ligado a um acesso."""
    alvo = email.strip().lower()
    for r in db.listar_recursos_eng(empresa_id, "operador"):
        try:
            d = json.loads(r["dados_json"]) if r["dados_json"] else {}
        except (TypeError, ValueError):
            d = {}
        if (d.get("email") or "").strip().lower() == alvo:
            d.update({"email": alvo, "modelo_drone": modelo_drone})
            with db._conectar() as conn:
                conn.execute("UPDATE recursos_eng SET nome = ?, dados_json = ? WHERE id = ?",
                             (nome, json.dumps(d, ensure_ascii=False), r["id"]))
            return
    db.criar_recurso_eng(uuid.uuid4().hex, empresa_id, "operador", nome,
                         json.dumps({"email": alvo, "modelo_drone": modelo_drone}, ensure_ascii=False))


@app.patch("/admin/usuarios/{usuario_id}")
def admin_atualizar_usuario(usuario_id: str, dados: UsuarioEmpresaUpdate, _: dict = Depends(exigir_superadmin)):
    usuario = db.obter_usuario(usuario_id)
    if usuario is None or usuario["perfil"] != "imobiliaria":
        raise HTTPException(status_code=404, detail="Acesso de empresa não encontrado.")
    nome, email = dados.nome.strip(), dados.email.strip().lower()
    if not nome or "@" not in email:
        raise HTTPException(status_code=400, detail="Informe nome e e-mail válidos.")
    empresa = db.obter_empresa(dados.empresa_id)
    if empresa is None:
        raise HTTPException(status_code=400, detail="Empresa não encontrada.")
    if dados.senha is not None and dados.senha and len(dados.senha) < 8:
        raise HTTPException(status_code=400, detail="A nova senha precisa ter pelo menos 8 caracteres.")
    hash_senha = _gerar_hash(dados.senha) if dados.senha else None
    try:
        atualizado = db.atualizar_usuario_empresa(usuario_id, nome, email, dados.empresa_id, hash_senha)
    except Exception as erro:
        if "unique" in str(erro).lower():
            raise HTTPException(status_code=409, detail="Este e-mail já está em uso.")
        raise
    if not atualizado:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if ramos.normalizar_ramo(empresa["ramo"]) == "engenharia" and (dados.modelo_drone or "").strip():
        _upsert_operador(dados.empresa_id, email, nome, dados.modelo_drone.strip())
    return next(dict(item) for item in db.listar_usuarios() if item["id"] == usuario_id)


@app.delete("/admin/usuarios/{usuario_id}")
def admin_excluir_usuario(usuario_id: str, _: dict = Depends(exigir_superadmin)):
    usuario = db.obter_usuario(usuario_id)
    if usuario is None or usuario["perfil"] != "imobiliaria":
        raise HTTPException(status_code=404, detail="Acesso de empresa não encontrado.")
    if not db.desativar_usuario(usuario_id):
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return {"ok": True}


@app.delete("/clientes/{cliente_id}")
def excluir_cliente(cliente_id: str):
    if not db.excluir_cliente(cliente_id):
        raise HTTPException(status_code=404, detail="cliente não encontrado")
    return {"ok": True}


# ----------------------------------------------------------------------
# imÃ³veis e cobranÃ§as de aluguel
# ----------------------------------------------------------------------
def _imovel_resposta(linha) -> dict:
    dados = dict(linha)
    dados["valor_aluguel"] = dados.pop("valor_aluguel_centavos") / 100
    dados["taxa_condominio"] = dados.pop("taxa_condominio_centavos") / 100
    return dados


def _cobranca_resposta(linha) -> dict:
    dados = dict(linha)
    dados["valor"] = dados.pop("valor_centavos") / 100
    if dados["status"] == "pendente" and dados["vencimento"] < date.today().isoformat():
        dados["status"] = "atrasado"
    return dados


@app.get("/imoveis")
def listar_imoveis(busca: str | None = None):
    return [_imovel_resposta(item) for item in db.listar_imoveis(busca)]


@app.post("/imoveis")
def criar_imovel(dados: ImovelDados):
    if dados.tipo not in {"Casa", "Apartamento", "Sala comercial", "Kitnet", "Terreno", "GalpÃ£o", "Outro"}:
        raise HTTPException(status_code=400, detail="tipo de imÃ³vel invÃ¡lido")
    if not dados.titulo.strip() or dados.valor_aluguel_centavos <= 0:
        raise HTTPException(status_code=400, detail="informe o nome do imÃ³vel e um valor de aluguel maior que zero")
    if dados.dia_vencimento is not None and not 1 <= dados.dia_vencimento <= 31:
        raise HTTPException(status_code=400, detail="o dia de vencimento deve estar entre 1 e 31")
    if dados.cliente_id and not any(item["id"] == dados.cliente_id for item in db.listar_clientes()):
        raise HTTPException(status_code=400, detail="cliente selecionado nÃ£o encontrado")
    identificador = uuid.uuid4().hex
    db.criar_imovel(
        identificador, dados.titulo.strip(), dados.tipo, dados.endereco.strip() if dados.endereco else None,
        dados.descricao.strip() if dados.descricao else None, dados.valor_aluguel_centavos,
        max(0, dados.taxa_condominio_centavos), dados.cliente_id, dados.dia_vencimento, None, None,
    )
    return _imovel_resposta(db.obter_imovel(identificador))


@app.post("/imoveis/{imovel_id}/foto")
def enviar_foto_imovel(imovel_id: str, foto: UploadFile = File(...)):
    if db.obter_imovel(imovel_id) is None:
        raise HTTPException(status_code=404, detail="imÃ³vel nÃ£o encontrado")
    if foto.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=400, detail="envie uma foto JPG, PNG ou WEBP")
    dados = foto.file.read()
    if not dados or len(dados) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="a foto deve ter no mÃ¡ximo 12 MB")
    extensao = _extensao_por_mime(foto.content_type, ".jpg")
    for anterior in UPLOADS_DIR.glob(f"imovel-{imovel_id}.*"):
        anterior.unlink(missing_ok=True)
    (UPLOADS_DIR / f"imovel-{imovel_id}{extensao}").write_bytes(dados)
    db.atualizar_foto_imovel(imovel_id, foto.filename or "foto do imÃ³vel", foto.content_type)
    return {"ok": True}


@app.get("/imoveis/{imovel_id}/foto")
def foto_imovel(imovel_id: str):
    imovel = db.obter_imovel(imovel_id)
    caminho = next(iter(UPLOADS_DIR.glob(f"imovel-{imovel_id}.*")), None)
    if imovel is None or caminho is None:
        raise HTTPException(status_code=404, detail="foto do imÃ³vel nÃ£o encontrada")
    return Response(content=caminho.read_bytes(), media_type=imovel["foto_mime"] or "image/jpeg")


@app.delete("/imoveis/{imovel_id}")
def excluir_imovel(imovel_id: str):
    if not db.excluir_imovel(imovel_id):
        raise HTTPException(status_code=404, detail="imÃ³vel nÃ£o encontrado")
    for arquivo in UPLOADS_DIR.glob(f"imovel-{imovel_id}.*"):
        arquivo.unlink(missing_ok=True)
    return {"ok": True}


@app.get("/cobrancas")
def listar_cobrancas(mes: str | None = None):
    if mes:
        try:
            competencia = date.fromisoformat(f"{mes}-01").strftime("%Y-%m")
        except ValueError:
            raise HTTPException(status_code=400, detail="informe uma competência válida")
        db.garantir_cobrancas_do_mes(competencia)
    return [_cobranca_resposta(item) for item in db.listar_cobrancas(mes)]


@app.post("/cobrancas")
def criar_cobranca(dados: CobrancaDados):
    try:
        competencia = date.fromisoformat(f"{dados.competencia}-01").strftime("%Y-%m")
        date.fromisoformat(dados.vencimento)
    except ValueError:
        raise HTTPException(status_code=400, detail="informe uma competÃªncia e vencimento vÃ¡lidos")
    imovel = db.obter_imovel(dados.imovel_id)
    if imovel is None or not imovel["cliente_id"]:
        raise HTTPException(status_code=400, detail="selecione um imÃ³vel que esteja alugado a um cliente")
    valor = dados.valor_centavos if dados.valor_centavos is not None else imovel["valor_aluguel_centavos"] + imovel["taxa_condominio_centavos"]
    if valor <= 0:
        raise HTTPException(status_code=400, detail="informe um valor maior que zero")
    identificador = uuid.uuid4().hex
    try:
        db.criar_cobranca(identificador, imovel["id"], imovel["cliente_id"], competencia, dados.vencimento, valor)
    except Exception as erro:
        if "UNIQUE" in str(erro):
            raise HTTPException(status_code=409, detail="jÃ¡ existe uma cobranÃ§a para este imÃ³vel nesta competÃªncia")
        raise
    return _cobranca_resposta(db.obter_cobranca(identificador))


@app.patch("/cobrancas/{cobranca_id}/status")
def atualizar_cobranca(cobranca_id: str, dados: CobrancaStatus):
    if dados.status not in {"pendente", "pago"}:
        raise HTTPException(status_code=400, detail="status deve ser pendente ou pago")
    if not db.atualizar_status_cobranca(cobranca_id, dados.status):
        raise HTTPException(status_code=404, detail="cobranÃ§a nÃ£o encontrada")
    return {"ok": True}


@app.post("/cobrancas/{cobranca_id}/enviar-lembrete")
def enviar_lembrete_cobranca(cobranca_id: str):
    linha = next((item for item in db.listar_cobrancas() if item["id"] == cobranca_id), None)
    if linha is None:
        raise HTTPException(status_code=404, detail="cobranÃ§a nÃ£o encontrada")
    if linha["status"] == "pago":
        raise HTTPException(status_code=400, detail="nÃ£o Ã© necessÃ¡rio cobrar um aluguel jÃ¡ pago")
    texto = texto_lembrete(linha)
    try:
        enviar_whatsapp(linha["cliente_contato"] or "", texto)
        db.registrar_lembrete_cobranca(cobranca_id)
    except EvolutionError as erro:
        raise HTTPException(status_code=502, detail=str(erro))
    return {"ok": True, "mensagem": texto}


@app.post("/cobrancas/processar-lembretes")
def processar_lembretes_agora():
    return {"enviados": processar_lembretes()}


# ----------------------------------------------------------------------
# documentos
# ----------------------------------------------------------------------
@app.get("/documentos")
def listar_documentos(busca: str | None = None):
    return [dict(item) for item in db.listar_documentos(busca)]


@app.post("/documentos")
def enviar_documento(
    arquivo: UploadFile = File(...),
    titulo: str = Form(...),
    categoria: str = Form("Geral"),
):
    dados = arquivo.file.read()
    if not dados or not titulo.strip():
        raise HTTPException(status_code=400, detail="informe título e selecione um arquivo")
    if len(dados) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="o arquivo deve ter no máximo 20 MB")
    identificador = uuid.uuid4().hex
    extensao = Path(arquivo.filename or "documento").suffix[:12]
    caminho = UPLOADS_DIR / f"documento-{identificador}{extensao}"
    caminho.write_bytes(dados)
    db.criar_documento(identificador, titulo.strip(), categoria.strip() or "Geral", arquivo.filename or "documento", arquivo.content_type, len(dados))
    return next(dict(item) for item in db.listar_documentos() if item["id"] == identificador)


@app.get("/documentos/{documento_id}/download")
def baixar_documento(documento_id: str):
    documento = next((item for item in db.listar_documentos() if item["id"] == documento_id), None)
    caminho = next(iter(UPLOADS_DIR.glob(f"documento-{documento_id}.*")), None)
    if documento is None or caminho is None:
        raise HTTPException(status_code=404, detail="documento não encontrado")
    return FileResponse(caminho, media_type=documento["mime"] or "application/octet-stream", filename=documento["nome_arquivo"])


@app.delete("/documentos/{documento_id}")
def excluir_documento(documento_id: str):
    if not db.excluir_documento(documento_id):
        raise HTTPException(status_code=404, detail="documento não encontrado")
    for arquivo in UPLOADS_DIR.glob(f"documento-{documento_id}.*"):
        arquivo.unlink(missing_ok=True)
    return {"ok": True}


# ----------------------------------------------------------------------
# WhatsApp / Evolution API
# ----------------------------------------------------------------------
@app.get("/whatsapp/status")
def whatsapp_status():
    try:
        return status_whatsapp()
    except EvolutionError as erro:
        return {"configurada": False, "estado": "indisponível", "erro": str(erro)}


@app.post("/whatsapp/conectar")
def whatsapp_conectar():
    try:
        resultado = conectar_whatsapp()
        if not resultado.get("qrcode"):
            raise HTTPException(status_code=502, detail="A Evolution não retornou um QR Code.")
        return resultado
    except EvolutionError as erro:
        raise HTTPException(status_code=502, detail=str(erro))
