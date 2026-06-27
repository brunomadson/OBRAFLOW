import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Formatação ───────────────────────────────────────────────────────────────
export function fmtBRL(value: number | null | undefined): string {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}

export function fmtDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function nowBR(): string {
  return new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Parsing ──────────────────────────────────────────────────────────────────
export function parseBRDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})\s+(\d{2}):(\d{2})$/);
  if (m1) {
    const ano = m1[3].length === 2 ? "20" + m1[3] : m1[3];
    return new Date(`${ano}-${m1[2]}-${m1[1]}T${m1[4]}:${m1[5]}:00`);
  }
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m2) return new Date(`${m2[3]}-${m2[2]}-${m2[1]}T00:00:00`);
  const iso = Date.parse(s);
  if (!isNaN(iso)) return new Date(iso);
  return null;
}

// ─── Cálculos de tempo ────────────────────────────────────────────────────────
export function diasDecorridos(dateStr: string | null | undefined): number | null {
  const d = parseBRDate(dateStr);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export function horasDecorridas(dateStr: string | null | undefined): number | null {
  const d = parseBRDate(dateStr);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60));
}

export function diasUteisDecorridos(dateStr: string | null | undefined): number | null {
  const d = parseBRDate(dateStr);
  if (!d) return null;
  let count = 0;
  const cur = new Date(d);
  const fim = new Date();
  while (cur < fim) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// ─── CPF ──────────────────────────────────────────────────────────────────────
export function validarCPF(cpf: string): boolean {
  const nums = cpf.replace(/\D/g, "");
  if (nums.length !== 11 || /^(\d)\1+$/.test(nums)) return false;
  const calc = (n: number) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += parseInt(nums[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 || r === 11 ? 0 : r;
  };
  return calc(9) === parseInt(nums[9]) && calc(10) === parseInt(nums[10]);
}

export function maskCPF(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, "$1.$2.$3-$4");
}

export function maskPhone(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{4,5})(\d{4})$/, "$1-$2");
}

// ─── Google Calendar ──────────────────────────────────────────────────────────
export function gerarLinkCalendar(params: {
  nomeCliente: string;
  data: string;
  hora: string;
  local: string;
  obs?: string;
}): string {
  const { nomeCliente, data, hora, local, obs = "" } = params;
  const inicio = `${data.replace(/-/g, "")}T${hora.replace(":", "")}00`;
  const [hh, mm] = hora.split(":").map(Number);
  const fimDate = new Date(data);
  fimDate.setHours(hh + 1, mm, 0, 0);
  const fimStr = fimDate.toISOString().slice(0, 10).replace(/-/g, "");
  const fim = `${fimStr}T${String(hh + 1).padStart(2, "0")}${String(mm).padStart(2, "0")}00`;
  const titulo = encodeURIComponent(`Reunião – ${nomeCliente} | ObraFlow`);
  const detalhe = encodeURIComponent(`Reunião comercial com ${nomeCliente}.\nLocal: ${local}\n${obs}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${titulo}&dates=${inicio}/${fim}&details=${detalhe}&location=${encodeURIComponent(local)}`;
}
