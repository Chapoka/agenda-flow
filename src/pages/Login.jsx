import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { db } from "@/api/dbClient";

const defaultSlides = [
  {
    image: "https://lh3.googleusercontent.com/aida-public/AB6AXuCsk57F8qRlqQFzn_ZuMoRItbWcd2yjn6MtjV6ncA1H-UEEeXEIU1QJKZVo4MrYAQSY4D3ifZnSK4DKe_WMM0BMF7GCplFTXh2PbwNwld7uN8UJGQbz-891DWooD9EKI9vkxyxZM3L3ImSa0Vp2Esr8asHptAe9SIF6LfCxAvyfqBJANBFb1ZH4FJNTwiUvWQsdCiHRfyzJ0tqbUWIxnbSxKHtYV7Iv2sbnc_fOmyNhcZql1NH8Wktu6qKwidbIa3Jz6vS55k8jm8nA",
    title: "Gestão Inteligente com AgendaFlow",
    subtitle: "Transforme a experiência dos seus clientes com agendamentos simplificados e controle total da sua rotina."
  }
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState(defaultSlides);

  useEffect(() => {
    db.entities.Settings.filter({ key: "login_carousel_images" })
      .then((results) => {
        if (results.length > 0 && results[0].value) {
          try {
            const parsed = JSON.parse(results[0].value);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setSlides(parsed.map((s) => ({
                image: s.image,
                title: s.title || "",
                subtitle: s.subtitle || ""
              })));
            }
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;

      if (data?.user?.id) {
        const { data: userProfile } = await supabase
          .from("users")
          .select("must_change_password")
          .eq("id", data.user.id)
          .single();

        if (userProfile?.must_change_password) {
          window.location.href = "/set-password";
          return;
        }
      }

      window.location.href = "/";
    } catch (err) {
      setError(err.message || "E-mail ou senha inválidos");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      setError("");
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || "Erro ao conectar com Google.");
    }
  };

  return (
    <main className="flex min-h-screen w-full flex-col lg:flex-row bg-background text-on-background font-body-md overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
      {/* Left Side: Visual Carousel */}
      <div className="relative hidden lg:flex lg:w-1/2 overflow-hidden bg-surface-container-lowest">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`absolute inset-0 z-0 transition-opacity duration-1000 ${i === currentSlide ? "opacity-100" : "opacity-0"}`}
          >
            <img
              src={slide.image}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent"></div>
          </div>
        ))}

        {/* Carousel Content Overlay */}
        <div className="relative z-10 flex flex-col justify-end p-margin-desktop w-full h-full pb-20">
          <div className="glass-card p-8 rounded-xl max-w-lg fade-in-up">
            <h2 className="font-headline-xl text-headline-xl text-white mb-stack-md leading-tight">
              {slides[currentSlide].title}
            </h2>
            <p className="font-body-lg text-body-lg text-on-surface-variant">
              {slides[currentSlide].subtitle}
            </p>
          </div>

          {/* Carousel Indicators */}
          <div className="flex gap-2 mt-stack-lg ml-8 fade-in-up delay-100">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === currentSlide ? "32px" : "8px",
                  background: i === currentSlide ? "#c0c1ff" : "#2d3449"
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col justify-center items-center p-margin-mobile lg:p-margin-desktop bg-gradient-to-br from-background to-surface-alt/30 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary-container/10 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md space-y-stack-lg z-10">
          {/* Brand & Header */}
          <div className="text-center space-y-stack-sm fade-in-up">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-surface border border-outline-variant/30 shadow-lg mb-4">
              <span
                className="material-symbols-outlined text-4xl text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                calendar_month
              </span>
            </div>
            <h1 className="font-headline-lg-mobile lg:font-headline-lg text-headline-lg-mobile lg:text-headline-lg gradient-text">
              Bem-vindo de volta
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Gerencie sua agenda com estilo e eficiência.
            </p>
          </div>

          {/* Form Area */}
          <div className="bg-surface p-6 sm:p-8 rounded-xl shadow-lg border border-outline-variant/20 fade-in-up delay-100">
            {/* Social Login */}
            <button
              onClick={handleGoogle}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white hover:bg-gray-50 text-gray-900 rounded-lg font-label-md text-label-md shadow-sm transition-colors border border-gray-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
              </svg>
              Continuar com Google
            </button>

            {/* Divider */}
            <div className="flex items-center my-6">
              <div className="flex-grow border-t border-outline-variant/30"></div>
              <span className="px-3 text-xs uppercase tracking-wider text-outline">ou entre com seu e-mail</span>
              <div className="flex-grow border-t border-outline-variant/30"></div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-container/20 text-error text-sm border border-error-container/30 flex items-center gap-2">
                <span className="text-error text-xs font-bold">!</span>
                {error}
              </div>
            )}

            {/* Email/Password Form */}
            <form onSubmit={handleSubmit} className="space-y-stack-md">
              {/* Email Input */}
              <div className="space-y-1">
                <label className="block font-label-md text-label-md text-on-surface" htmlFor="email">E-mail</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline z-20">
                    <span className="material-symbols-outlined text-lg">mail</span>
                  </span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="voce@exemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 bg-surface-container-highest border border-outline-variant/50 rounded-lg text-on-surface placeholder-outline focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm relative z-10 cursor-text"
                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="block font-label-md text-label-md text-on-surface" htmlFor="password">Senha</label>
                  <Link to="/forgot-password" className="font-body-sm text-body-sm text-primary hover:text-primary-container transition-colors">
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline z-20">
                    <span className="material-symbols-outlined text-lg">lock</span>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 bg-surface-container-highest border border-outline-variant/50 rounded-lg text-on-surface placeholder-outline focus:ring-2 focus:ring-primary focus:border-primary transition-all sm:text-sm relative z-10 cursor-text"
                    style={{ userSelect: "text", WebkitUserSelect: "text" }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline hover:text-on-surface transition-colors z-20 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg font-label-md text-label-md text-white gradient-btn shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </div>
            </form>
          </div>

          {/* Footer Link */}
          <div className="text-center fade-in-up delay-200">
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Não tem uma conta?{" "}
              <Link to="/register" className="text-tertiary hover:text-tertiary-fixed-dim font-semibold transition-colors">
                Cadastre-se
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .fade-in-up {
          animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(10px);
        }
        .delay-100 { animation-delay: 100ms; }
        .delay-200 { animation-delay: 200ms; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .glass-card {
          background: rgba(30, 41, 59, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .gradient-text {
          background: linear-gradient(to right, #c0c1ff, #571bc1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .gradient-btn {
          background: linear-gradient(135deg, #494bd6 0%, #571bc1 100%);
          transition: all 0.2s ease-in-out;
        }
        .gradient-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 0 15px rgba(87, 27, 193, 0.5);
        }
        /* Esconde olho nativo do Edge/Chrome que duplicava o custom */
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear,
        input[type="password"]::-webkit-credentials-auto-fill-button,
        input[type="password"]::-webkit-contacts-auto-fill-button {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          width: 0 !important;
          height: 0 !important;
        }
        input::-ms-reveal { display: none !important; }
      `}</style>
    </main>
  );
}
