import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { BrandMark, BrandName } from '@/components/brand';
import { ThemeSwitcher } from '@/theme/theme-switcher';

/**
 * Pantallas de entrada (login, recuperación, cambio obligatorio). A la izquierda
 * el escenario de marca «cuaderno y lapicero»; en celular y tablet se reduce a
 * una franja con el logo y el titular.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background lg:flex-row">
      <BrandStage />
      <main className="flex min-w-0 flex-1 flex-col gap-6 bg-[radial-gradient(70%_50%_at_100%_0%,color-mix(in_srgb,var(--primary)_9%,transparent)_0%,transparent_70%)] px-4 pt-4 pb-6 sm:px-8 lg:basis-[44%] lg:px-12 lg:pt-7 lg:pb-8">
        <div className="flex justify-end">
          <ThemeSwitcher />
        </div>
        <div className="flex flex-1 items-start justify-center sm:items-center">{children}</div>
        <p className="text-center text-sm text-muted-foreground">
          ¿No puedes entrar? Escribe a la secretaría de tu institución.
        </p>
      </main>
    </div>
  );
}

/** Tarjeta del formulario (misma en todas las pantallas de entrada). */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-5 rounded-3xl border border-border bg-card px-5 py-7 shadow-[0_1px_2px_rgb(26_33_66/0.06),0_24px_60px_rgb(26_33_66/0.12)] sm:p-10 dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_30px_70px_rgb(0_0_0/0.45)]">
      {children}
    </div>
  );
}

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div>
      <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">{title}</h1>
      {description && <p className="mt-2 leading-normal text-muted-foreground">{description}</p>}
    </div>
  );
}

const STAGE_BG =
  'radial-gradient(120% 90% at 85% 100%, var(--stage-glow) 0%, transparent 55%), radial-gradient(80% 70% at 0% 0%, rgb(142 162 255 / 0.2) 0%, transparent 60%), repeating-linear-gradient(180deg, transparent 0 31px, rgb(255 255 255 / 0.045) 31px 32px)';

function BrandStage() {
  return (
    <section
      aria-label="Aula360"
      className="relative flex shrink-0 flex-col gap-5 overflow-hidden bg-stage py-7 pr-6 pl-10 text-white lg:basis-[56%] lg:gap-8 lg:py-12 lg:pr-16 lg:pl-26"
      style={{ backgroundImage: STAGE_BG }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-5 w-0.5 bg-linear-to-b from-transparent via-[#F07A8F]/75 to-transparent lg:left-18"
      />
      <div className="relative flex items-center gap-3">
        <BrandMark />
        <BrandName />
      </div>
      <div className="relative max-w-[560px]">
        <p className="text-[30px] leading-[1.04] font-extrabold tracking-[-0.03em] text-balance lg:text-6xl">
          Las notas del colegio, claras para todos.
        </p>
        <p className="mt-5 hidden max-w-[470px] text-[19px] leading-normal text-[#C9D3F5] lg:block">
          Docentes califican, coordinación revisa y cada familia recibe su boletín. Cada quien entra
          con su propio acceso.
        </p>
      </div>
      <Composition />
      <p className="relative hidden text-sm text-[#A9B3D3] lg:block">
        Para colegios y escuelas de Colombia, con una o varias sedes.
      </p>
    </section>
  );
}

const SUBJECTS = [
  { name: 'Matemáticas', grade: '4,80', level: 'Superior', chip: 'bg-[#2343C4] text-white' },
  { name: 'Lengua castellana', grade: '4,30', level: 'Alto', chip: 'bg-[#CDEBE3] text-[#0B544C]' },
  {
    name: 'Ciencias naturales',
    grade: '3,60',
    level: 'Básico',
    chip: 'bg-[#F6E7B0] text-[#5E4700]',
  },
  { name: 'Inglés', grade: '4,62', level: 'Superior', chip: 'bg-[#2343C4] text-white' },
];

/** Ilustración: boletín en papel, resumen del curso y aviso. Solo decorativa. */
function Composition() {
  // Lienzo fijo de 690×520 escalado según el ancho (portátil 60 %, escritorio 85 %, 2K 100 %).
  return (
    <div
      aria-hidden="true"
      className="relative ml-10 hidden min-h-[312px] flex-1 lg:block xl:min-h-[442px] 2xl:min-h-[520px]"
    >
      <div className="absolute top-0 left-0 h-[520px] w-[690px] origin-top-left scale-[0.6] xl:scale-[0.85] 2xl:scale-100">
        <div className="absolute top-[34px] left-[150px] h-[400px] w-[360px] rotate-[5deg] rounded-[18px] bg-[#C9D3F5] shadow-[0_30px_60px_rgb(3_7_30/0.35)] dark:bg-[#2C3864]" />

        <div className="absolute top-2.5 left-[120px] w-[380px] -rotate-3 overflow-hidden rounded-[18px] bg-white text-[#1A2142] shadow-[inset_0_2px_0_rgb(255_255_255/0.6),0_40px_80px_rgb(3_7_30/0.45),0_8px_20px_rgb(3_7_30/0.25)]">
          <div className="absolute inset-y-0 left-[30px] w-0.5 bg-[#D33F5A]/55" />
          <div className="border-b border-[#E3E9F2] py-[22px] pr-6 pb-3.5 pl-12">
            <div className="text-[13px] text-[#4E5878]">Boletín del segundo periodo</div>
            <div className="mt-1 text-[19px] font-extrabold tracking-tight">
              Sofía Escobar Mejía
            </div>
            <div className="mt-0.5 text-[13px] text-[#4E5878]">Séptimo B, sede principal</div>
          </div>
          {SUBJECTS.map((s) => (
            <div
              key={s.name}
              className="flex h-10 items-center gap-3 border-b border-[#E3E9F2] pr-6 pl-12"
            >
              <span className="min-w-0 flex-1 text-[15px]">{s.name}</span>
              <span className="text-[17px] font-extrabold">{s.grade}</span>
              <span
                className={`inline-flex min-w-[70px] justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${s.chip}`}
              >
                {s.level}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 bg-[#F5F7FA] py-3.5 pr-6 pb-[18px] pl-12">
            <span className="flex-1 text-sm font-bold">Promedio del periodo</span>
            <span className="text-2xl font-extrabold text-[#2343C4]">4,33</span>
          </div>
        </div>

        <div className="absolute top-[372px] left-0 w-[260px] -rotate-1 rounded-2xl border border-white/20 bg-[#1A2142]/60 px-5 py-[18px] shadow-[0_24px_48px_rgb(3_7_30/0.4)] backdrop-blur-md dark:bg-[#161E3C]/75">
          <div className="text-[13px] text-[#C9D3F5]">Séptimo B, 34 estudiantes</div>
          <div className="mt-0.5 text-[17px] font-extrabold">Desempeño del periodo</div>
          <div className="mt-3.5 flex h-3 gap-0.5 overflow-hidden rounded-full">
            <span className="flex-[2] bg-[#F08A4B]" />
            <span className="flex-[8] bg-[#F6E7B0]" />
            <span className="flex-[15] bg-[#7FD3BF]" />
            <span className="flex-[9] bg-[#8EA2FF]" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-[#E7EBF7]">
            <span>Bajo, 2</span>
            <span>Básico, 8</span>
            <span>Alto, 15</span>
            <span>Superior, 9</span>
          </div>
        </div>

        <div className="absolute top-[44px] left-[440px] inline-flex items-center gap-2.5 rounded-[14px] bg-white py-3 pr-4 pl-3 text-sm font-bold whitespace-nowrap text-[#1A2142] shadow-[0_18px_40px_rgb(3_7_30/0.4)]">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-[#CDEBE3] text-[#0B544C]">
            <Check className="size-4" strokeWidth={3} />
          </span>
          Boletines del curso generados
        </div>
      </div>
    </div>
  );
}
