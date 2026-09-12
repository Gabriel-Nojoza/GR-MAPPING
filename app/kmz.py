"""
Importação de rota de obra a partir de um arquivo KMZ/KML (projeto exportado
do Google Earth / My Maps).

Um KMZ real de adutora costuma ter uma pasta por trecho ("TRECHO DN600 -
MARACANAÚ", por exemplo), cada uma com:
  - um Placemark com o traçado (LineString) daquele trecho;
  - uma pasta irmã com "ESTACA" no nome, contendo um Placemark por estaca
    (E0, E1, E2... a cada 20m), cada um com um Point + dados extras
    (Estaca/E/S/Cota TN/Cota GI/Profundidade) em ExtendedData/SchemaData.

Só biblioteca padrão (zipfile + xml.etree.ElementTree) — nenhuma dependência
nova precisa ser instalada.
"""
from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

from app import geo

_PALAVRAS_MATERIAL = ("PEAD", "DEFOFO", "FOFO", "PVC", "AÇO", "ACO", "CONCRETO", "FIBRA")


@dataclass
class Estaca:
    codigo: str
    lat: float
    lon: float
    progressiva_m: float | None = None
    cota_tn: float | None = None
    cota_gi: float | None = None
    profundidade_m: float | None = None


@dataclass
class TrechoImportado:
    nome: str
    coordenadas: list[tuple[float, float]] = field(default_factory=list)  # (lon, lat)
    extensao_m: float = 0.0
    diametro_mm: float | None = None
    material: str | None = None
    estacas: list[Estaca] = field(default_factory=list)


def _tag(elemento) -> str:
    """Remove o prefixo de namespace ("{...}Placemark" -> "Placemark")."""
    t = elemento.tag
    return t.split("}", 1)[1] if "}" in t else t


def _filhos(elemento, nome: str):
    return [f for f in elemento if _tag(f) == nome]


def _filho(elemento, nome: str):
    achado = _filhos(elemento, nome)
    return achado[0] if len(achado) > 0 else None


def _nome_de(elemento) -> str:
    n = _filho(elemento, "name")
    return (n.text or "").strip() if n is not None and n.text else ""


def _coords_de_texto(texto: str) -> list[tuple[float, float]]:
    """"lon,lat,alt lon,lat,alt ..." -> [(lon, lat), ...] (descarta a altitude)."""
    pontos: list[tuple[float, float]] = []
    for parte in (texto or "").split():
        campos = parte.split(",")
        if len(campos) >= 2:
            try:
                pontos.append((float(campos[0]), float(campos[1])))
            except ValueError:
                continue
    return pontos


def _linestring_do_placemark(placemark) -> list[tuple[float, float]] | None:
    ls = _filho(placemark, "LineString")
    if ls is None:
        return None
    coords_el = _filho(ls, "coordinates")
    if coords_el is None or not coords_el.text:
        return None
    pontos = _coords_de_texto(coords_el.text)
    return pontos if len(pontos) >= 2 else None


def _point_do_placemark(placemark) -> tuple[float, float] | None:
    pt = _filho(placemark, "Point")
    if pt is None:
        return None
    coords_el = _filho(pt, "coordinates")
    if coords_el is None or not coords_el.text:
        return None
    pontos = _coords_de_texto(coords_el.text)
    return pontos[0] if pontos else None


def _extended_data(placemark) -> dict[str, str]:
    """Lê ExtendedData/SchemaData/SimpleData, indexado pelo `name` de cada campo
    (ex.: "COL5C1143B723BCC8D5" -> "0+20.00"), e também tenta casar pela
    `displayName` do Schema quando disponível (não é feito aqui — o chamador
    decide pelo VALOR já que os nomes de coluna variam por arquivo)."""
    saida: dict[str, str] = {}
    for ext in _filhos(placemark, "ExtendedData"):
        for schema_data in _filhos(ext, "SchemaData"):
            for simple in _filhos(schema_data, "SimpleData"):
                chave = simple.attrib.get("name", "")
                if chave:
                    saida[chave] = (simple.text or "").strip()
    return saida


_RE_NUM = re.compile(r"-?\d+(?:[.,]\d+)?")


def _numero(texto: str | None) -> float | None:
    """Extrai um número decimal de um campo (ex.: "48.687" -> 48.687). As
    cotas/profundidade do KML real usam ponto como separador decimal — só a
    "Estaca" (código de estaqueamento, tipo "76+60,00") usa vírgula, e essa
    não passa por aqui."""
    if not texto:
        return None
    m = _RE_NUM.search(texto)
    if not m:
        return None
    try:
        return float(m.group().replace(",", "."))
    except ValueError:
        return None


def _estaca_do_placemark(placemark) -> Estaca | None:
    ponto = _point_do_placemark(placemark)
    if ponto is None:
        return None
    lon, lat = ponto
    codigo = _nome_de(placemark) or "?"
    dados = _extended_data(placemark)
    valores = list(dados.values())
    # a ordem das colunas no schema é sempre: ID, Estaca(s), E, S, Cota TN, Cota GI, Profundidade
    # (ver exemplo real "ADUTORA - TQ.kml") — usamos posição, não o nome da
    # coluna (que é um hash aleatório e varia por arquivo exportado).
    cota_tn = _numero(valores[4]) if len(valores) > 4 else None
    cota_gi = _numero(valores[5]) if len(valores) > 5 else None
    profundidade = _numero(valores[6]) if len(valores) > 6 else None
    return Estaca(codigo=codigo, lat=lat, lon=lon, cota_tn=cota_tn, cota_gi=cota_gi, profundidade_m=profundidade)


def _diametro_e_material(nome: str) -> tuple[float | None, str | None]:
    diametro = None
    m = re.search(r"DN\s*0*(\d{2,4})", nome, re.IGNORECASE)
    if m:
        diametro = float(m.group(1))
    material = next((p.title() for p in _PALAVRAS_MATERIAL if p in nome.upper()), None)
    return diametro, material


def _concatenar_linhas(linhas: list[list[tuple[float, float]]]) -> list[tuple[float, float]]:
    """Junta várias LineStrings na ordem em que aparecem (ex.: um trecho que muda
    de diâmetro no meio costuma ter 2 Placemarks separados, um pra cada
    diâmetro, com o fim de um exatamente igual ao começo do próximo) — evita
    duplicar o ponto de junção quando ele se repete."""
    coords: list[tuple[float, float]] = []
    for linha in linhas:
        if coords and linha and coords[-1] == linha[0]:
            coords.extend(linha[1:])
        else:
            coords.extend(linha)
    return coords


def _percorrer(pasta, encontrados: list[TrechoImportado]) -> None:
    """Percorre pastas recursivamente; toda pasta com Placemark(s) de LineString
    vira um trecho (várias LineStrings na mesma pasta são concatenadas, na
    ordem em que aparecem — comum quando o trecho muda de diâmetro no meio),
    junto com a pasta irmã "ESTACA*" (se existir)."""
    subpastas = _filhos(pasta, "Folder")
    placemarks = _filhos(pasta, "Placemark")

    linhas_placemarks = [(pm, _linestring_do_placemark(pm)) for pm in placemarks]
    linhas_placemarks = [(pm, c) for pm, c in linhas_placemarks if c is not None]
    if linhas_placemarks:
        primeiro_placemark = linhas_placemarks[0][0]
        nome_trecho = _nome_de(pasta) or _nome_de(primeiro_placemark) or "Trecho importado"
        coords = _concatenar_linhas([c for _, c in linhas_placemarks])
        diametro, material = _diametro_e_material(nome_trecho)
        trecho = TrechoImportado(
            nome=nome_trecho,
            coordenadas=coords,
            extensao_m=round(geo.comprimento_linha(coords), 1),
            diametro_mm=diametro,
            material=material,
        )
        pasta_estacas = next((p for p in subpastas if "ESTACA" in _nome_de(p).upper()), None)
        if pasta_estacas is not None:
            for pm in _filhos(pasta_estacas, "Placemark"):
                estaca = _estaca_do_placemark(pm)
                if estaca is None:
                    continue
                estaca.progressiva_m = geo.progressiva(coords, estaca.lat, estaca.lon)
                trecho.estacas.append(estaca)
        encontrados.append(trecho)
        # não desce mais nessa pasta — a pasta de estacas já foi tratada acima
        return

    for sub in subpastas:
        _percorrer(sub, encontrados)


def _carregar_kml_bytes(dados: bytes) -> bytes:
    if zipfile.is_zipfile(io.BytesIO(dados)):
        with zipfile.ZipFile(io.BytesIO(dados)) as zf:
            candidato = next((n for n in zf.namelist() if n.lower().endswith(".kml")), None)
            if candidato is None:
                raise ValueError("o arquivo .kmz não contém nenhum .kml dentro")
            return zf.read(candidato)
    return dados


def parse_kmz_kml(dados: bytes) -> list[TrechoImportado]:
    """Extrai os trechos (traçado + estacas) de um arquivo .kmz ou .kml."""
    kml_bytes = _carregar_kml_bytes(dados)
    raiz = ET.fromstring(kml_bytes)
    documento_encontrado = _filho(raiz, "Document")
    documento = documento_encontrado if documento_encontrado is not None else raiz
    encontrados: list[TrechoImportado] = []
    # só desce em pastas (Folder) — Placemarks soltos direto no Document são
    # marcos avulsos (reservatório, travessias, canteiro...), não o traçado
    for sub in _filhos(documento, "Folder"):
        _percorrer(sub, encontrados)
    return encontrados
