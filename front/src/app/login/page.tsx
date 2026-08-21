"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, Ruler } from "lucide-react";
import Image from "next/image";
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
    // Esta tela ainda não valida credenciais na API. A autenticação real
    // deve ser conectada aqui antes de publicar o sistema.
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

      sessionStorage.setItem("medicao-terreno:acesso", "autorizado");
      router.replace("/");
    } catch {
      setError("Não foi possível validar o acesso. Confirme que a API está ligada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#0f172a] p-12 text-white lg:flex">
        <div className="login-glow absolute -left-28 top-1/4 size-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="login-glow absolute -right-32 bottom-0 size-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="flex items-center gap-3 text-xl font-semibold">
          <span className="grid size-11 place-items-center rounded-xl bg-white/15">
            <Ruler size={24} />
          </span>
          Medição de Terreno
        </div>
        <div className="login-entrance relative max-w-md">
          <Image
            src="/logo.png"
            alt="GR Mapping"
            width={260}
            height={260}
            priority
            className="login-logo-float mb-7 h-auto w-52 object-contain"
          />
          <p className="text-4xl font-semibold leading-tight">
            Mais precisão para os seus projetos.
          </p>
          <p className="mt-5 text-base leading-7 text-indigo-100">
            Meça áreas a partir de imagens aéreas e acompanhe seus terrenos em um só lugar.
          </p>
        </div>
        <p className="text-sm text-indigo-200">© {new Date().getFullYear()} Medição de Terreno</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-3 text-xl font-semibold text-indigo-700">
              <span className="grid size-11 place-items-center rounded-xl bg-indigo-100"><Ruler size={24} /></span>
              Medição de Terreno
            </div>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Bem-vindo de volta</h1>
          <p className="mt-2 text-slate-500">Entre com seus dados para acessar a plataforma.</p>

          <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">E-mail</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                <input name="email" type="email" autoComplete="email" placeholder="voce@exemplo.com" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-4 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Senha</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                <input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" className="w-full rounded-lg border border-slate-300 py-3 pl-10 pr-12 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100" />
                <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </span>
            </label>

            {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#2563eb] py-3 font-medium text-white shadow-lg shadow-blue-500/20 transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-wait disabled:opacity-70">
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
