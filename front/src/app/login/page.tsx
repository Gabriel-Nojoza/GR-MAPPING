"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
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
    "w-full rounded-lg border border-white/15 bg-white/10 py-3 pl-10 pr-4 text-white outline-none transition placeholder:text-white/40 focus:border-blue-400 focus:bg-white/15 focus:ring-2 focus:ring-blue-400/30";

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#0a1424] bg-cover bg-center px-4 py-10 sm:justify-end sm:px-10 lg:px-24"
      style={{ backgroundImage: "url(/capa.png)" }}
    >
      {/* escurece o lado direito pra dar contraste ao form */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-[#0a1424]/95 via-[#0a1424]/70 to-transparent" />

      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-slate-950/60 p-8 shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Bem-vindo de volta</h1>
        <p className="mt-1.5 text-sm text-white/60">Entre com seus dados para acessar a plataforma.</p>

        <form className="mt-7 space-y-4" onSubmit={handleSubmit} noValidate>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/80">E-mail</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" className={campo} />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white/80">Senha</span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                className={`${campo} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((c) => !c)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {error && <p role="alert" className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#2563eb] py-3 font-medium text-white shadow-lg shadow-blue-900/40 transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-2 focus:ring-blue-300/40 disabled:cursor-wait disabled:opacity-70"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/40">© {new Date().getFullYear()} GR Mapping</p>
      </div>
    </div>
  );
}
