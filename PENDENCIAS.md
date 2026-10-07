# Pendências — Avanço de obras lineares

Registro do que já foi feito e do que falta, pra não se perder entre sessões.
Atualizado em 2026-10-06.

## Status atual

O código de todas as funcionalidades abaixo já está no GitHub (branch `main`),
mas **ainda não está no ar no VPS de produção** — ver "Deploy pendente" abaixo.

Funcionalidades prontas e testadas (commits `b359929`, `34e5a9a`, `c379298`):

- Importação de rota por KMZ/KML (trechos, diâmetro, material, estacas)
- Cálculo de avanço em metros a partir do GPS de cada foto/vídeo
- Painel de progresso por obra (executado x planejado, produtividade diária,
  impacto da chuva, previsão de conclusão)
- "Situação do prazo" (adiantada/atrasada, comparando a previsão recalculada
  com o prazo cadastrado na obra)
- Marcos soltos do KMZ (travessia, reservatório, ETA, booster, canteiro) no
  mapa, com marcação manual também disponível
- Rota automática: a partir da 2ª captura com GPS, o sistema traça a rota
  sozinho, sem precisar desenhar nada na mão (com recálculo retroativo da
  posição de capturas enviadas antes da rota existir)
- Fila de upload offline (IndexedDB): se a conexão cair durante o envio em
  campo, os arquivos ficam guardados no aparelho e são reenviados sozinhos
- Correção de um bug de modal (a tela de "Editar rota / marcos" aparecia
  atrás do mapa da página, por causa de um z-index da barra de busca do mapa
  maior que o do modal)
- Correção de um erro ao excluir um voo já excluído (clique duplo quebrava
  a tela com um erro cru do Next.js)

## O que falta

### 1. Deploy no VPS (prioridade alta)

Nada do que está listado acima está em produção ainda. Rodar no VPS:

```bash
cd /opt/gr-mapping && git pull origin main && \
export NEXT_PUBLIC_API_URL="http://77.37.43.210:8001" && \
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build api front
```

Pra confirmar que subiu: `GET /eng/obras/{id}/avanco-linear` numa obra
qualquer deve trazer o campo `status_prazo` na resposta — se não trouxer,
ainda está na versão antiga.

Em 2026-10-06 o VPS (`77.37.43.210`) não respondeu a uma checagem simples
(`/saude`, timeout) — vale confirmar se o servidor está no ar antes de mais
nada.

### 2. Bug de arquivos de foto sumindo do servidor

Durante o teste de campo real (setembro/2026), pelo menos duas fotos
enviadas tiveram seu arquivo físico desaparecer do servidor pouco depois do
upload — o registro continuava no banco (GPS certo, metadados certos), mas
`GET /eng/voos/{voo_id}/fotos/{foto_id}/imagem` passava a responder 404
("foto não encontrada"). O volume de uploads no `docker-compose.vps.yml`
(`gr_mapping_data:/data`) é persistente, então não deveria se perder num
rebuild — a causa ainda não foi investigada de verdade (precisa de acesso
direto ao VPS: conferir `docker compose ps`/logs do container `api`, espaço
em disco, e se o container reiniciou sozinho em algum momento).

Não afeta o cálculo de avanço em metros (que só depende do GPS, já salvo no
banco) — só a visualização da imagem e a leitura de QR ficam prejudicadas
quando acontece.

### 3. Importar o KMZ real numa obra de produção

Até agora o KMZ real do cliente ("ADUTORA - TQ.kml", 3 trechos — DN600
Maracanaú ~1,4km, DN1000 ~3,75km, DN600/DN500 Maranguape ~7,7km) só foi
testado em obras de demonstração. Falta importar numa obra real (Maracanaú 1
ou 2) depois que o deploy acontecer.

### 4. Menor: umidade não é usada em nada

O histórico diário mostra `umidade_pct`, mas só a chuva (`chuva_mm`) entra
de fato no cálculo de produtividade/previsão. Não chega a ser um problema,
mas se quiser que a umidade também pese no cálculo, isso ainda não foi feito.
