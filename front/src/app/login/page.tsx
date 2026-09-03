"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!email || !password) {
      setError("Informe seu e-mail e sua senha para continuar.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha: password }),
      });

      if (!response.ok) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      const dados = await response.json();
      sessionStorage.setItem("medicao-terreno:acesso", "autorizado");
      sessionStorage.setItem("medicao-terreno:token", dados.token);
      sessionStorage.setItem("medicao-terreno:usuario", JSON.stringify(dados.usuario));
      const destino =
        dados.usuario.perfil === "superadmin"
          ? "/admin"
          : dados.usuario.empresa_ramo === "engenharia"
            ? "/eng"
            : "/";
      router.replace(destino);
    } catch (causa) {
      const detalhe = causa instanceof Error ? causa.message : "erro desconhecido";
      setError(`Não foi possível concluir o login: ${detalhe}`);
    } finally {
      setLoading(false);
    }
  }

  const campo =
    "w-full border-0 border-b border-white/25 bg-transparent pb-2 pt-1 text-white outline-none transition placeholder:text-white/35 focus:border-blue-400";

  return (
    <div className="relative min-h-screen bg-[#0a1424]">
      {/* fundo fixo: cobre a viewport em qualquer zoom */}
      <div
        className="fixed inset-0 bg-[#0a1424] bg-cover bg-center"
        style={{ backgroundImage: "url(/capa.png)" }}
      />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-l from-[#0a1424] via-[#0a1424]/75 to-transparent" />

      {/* conteúdo: rola quando o zoom deixa o form maior que a tela */}
      <div className="relative flex min-h-screen items-center justify-center px-6 py-16 sm:justify-end sm:px-12 lg:px-28">
        <div className="w-[24rem] max-w-full">
          <h1 className="text-3xl font-bold tracking-tight text-white">Entrar no sistema</h1>
          <p className="mt-2 text-sm text-white/55">Use o usuário cadastrado.</p>

          <form className="mt-8 space-y-7" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <span className="mb-1 block text-sm text-white/70">E-mail</span>
              <input name="email" type="email" autoComplete="email" placeholder="voce@email.com" className={campo} />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-white/70">Senha</span>
              <span className="relative block">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Sua senha"
                  className={`${campo} pr-8`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((c) => !c)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {error && <p role="alert" className="rounded bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full border border-white/40 py-3.5 text-sm font-semibold uppercase tracking-[0.22em] text-white transition hover:bg-white hover:text-[#0a1424] disabled:cursor-wait disabled:opacity-60"
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <p className="mt-10 text-xs text-white/35">© {new Date().getFullYear()} GR Mapping</p>
        </div>
      </div>
    </div>
  );
}
