"""
Job store em memória pra acompanhar o progresso da geração de projeto.

A geração de vídeo demora minutos (a IA processa em segundo plano), então
o pedido roda numa BackgroundTask e o front consulta o status via job_id.

Simples de propósito: um dict em memória é suficiente pra uma API de
instância única. Se um dia rodar com mais de um worker/processo, cada um
teria sua própria cópia dos jobs — nesse caso troque por um backend
compartilhado (Redis, banco) antes de escalar.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from enum import Enum
from threading import Lock
from typing import Any


class JobStatus(str, Enum):
    PROCESSANDO = "processando"
    PRONTO = "pronto"
    ERRO = "erro"


@dataclass
class Job:
    id: str
    status: JobStatus = JobStatus.PROCESSANDO
    erro: str | None = None
    imagem_bytes: bytes | None = None
    imagem_mime: str | None = None
    video_bytes: bytes | None = None
    video_mime: str | None = None
    video_obj: Any = None          # objeto Video da API — necessário pra estender o vídeo
    descricao: str | None = None
    duracao_total_s: int = 0
    grupo_id: str | None = None
    etapa: str | None = None


_jobs: dict[str, Job] = {}
_lock = Lock()


def criar_job(grupo_id: str | None = None, etapa: str | None = None) -> Job:
    job = Job(id=uuid.uuid4().hex, grupo_id=grupo_id, etapa=etapa)
    with _lock:
        _jobs[job.id] = job
    return job


def obter_job(job_id: str) -> Job | None:
    with _lock:
        return _jobs.get(job_id)
