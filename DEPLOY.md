# Publicação: Vercel + Render

## 1. Repositório

Publique este projeto em um repositório privado no GitHub. Os arquivos `.env`, o banco SQLite e os uploads já são ignorados pelo Git.

## 2. API no Render

1. No Render, escolha **New > Blueprint** e conecte o repositório.
2. O Render encontrará o arquivo `render.yaml` e criará a API.
3. Informe os valores solicitados para `GEMINI_API_KEY` e os dois usuários de login.
4. Após o primeiro deploy, copie a URL da API, por exemplo: `https://medicao-terreno-api.onrender.com`.
5. Em **Environment**, configure `CORS_ORIGINS` com a URL final do Vercel, por exemplo: `https://meu-projeto.vercel.app`.

O serviço usa um disco persistente em `/var/data`, que mantém `dados.db` e os arquivos em `uploads` entre deploys. Esse recurso exige um plano pago compatível no Render.

## 3. Frontend no Vercel

1. No Vercel, importe o mesmo repositório GitHub.
2. Defina **Root Directory** como `front`.
3. Em **Environment Variables**, crie `NEXT_PUBLIC_API_URL` com a URL copiada do Render.
4. Faça o deploy.
5. Copie a URL do Vercel para `CORS_ORIGINS` no Render e faça um novo deploy da API.

## 4. Conferência

1. Abra `https://sua-api.onrender.com/saude`; a resposta deve confirmar que a API está no ar.
2. Abra a URL do Vercel e faça login.
3. Envie uma foto de teste e confirme que ela permanece disponível após um novo deploy.

## Publicação em VPS com Docker

Se preferir hospedar tudo em uma VPS, copie `.env.vps.example` para `.env.vps`, preencha o IP público e os segredos, e execute:

```bash
docker compose --env-file .env.vps -f docker-compose.vps.yml up -d --build
```

Por padrão, a interface ficará em `http://IP_DA_VPS:3001` e a API em `http://IP_DA_VPS:8001`. Antes de executar, confirme que essas portas não são usadas pelo outro projeto e abra-as no firewall da VPS.
