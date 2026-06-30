import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type Patrocinador = {
  id: string;
  nome: string;
  nomeCurto: string;
  instagram?: string;
  corPrimaria: string;
  corSecundaria: string;
  corFundo: string;
  corTexto: string;
  corCard: string;
  descricao: string;
  avisoQr: string;
};

type SponsorContextData = {
  patrocinador: Patrocinador | null;
  temPatrocinador: boolean;
  codigoPatrocinador: string;
  setPatrocinadorManual: (codigo: string) => void;
  limparPatrocinador: () => void;
};

const STORAGE_KEY = "bolao10_patrocinador";

const PATROCINADORES: Record<string, Patrocinador> = {
  aura: {
    id: "aura",
    nome: "Aura Lounge",
    nomeCurto: "Aura",
    instagram: "@auraloungee",
    corPrimaria: "#D6A941",
    corSecundaria: "#0B3D1C",
    corFundo: "#050A07",
    corTexto: "#FFFFFF",
    corCard: "#061A10",
    descricao: "Edição especial para quem entrou pelo QR oficial da Aura Lounge.",
    avisoQr: "QR exclusivo Aura Lounge",
  },
};

function normalizarCodigo(codigo?: string | null) {
  return String(codigo || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "");
}

function getStorage() {
  try {
    if (Platform.OS === "web") {
      return (globalThis as any)?.localStorage || null;
    }
  } catch (error) {
    console.log("Storage indisponível:", error);
  }

  return null;
}

function lerParametroPatrocinador() {
  try {
    if (Platform.OS !== "web") return "";

    const location = (globalThis as any)?.location;
    if (!location?.search) return "";

    const params = new URLSearchParams(location.search);

    return (
      params.get("patrocinador") ||
      params.get("sponsor") ||
      params.get("origem") ||
      params.get("utm_source") ||
      ""
    );
  } catch (error) {
    console.log("Erro ao ler patrocinador da URL:", error);
    return "";
  }
}

function urlPediuLimpeza() {
  try {
    if (Platform.OS !== "web") return false;

    const location = (globalThis as any)?.location;
    if (!location?.search) return false;

    const params = new URLSearchParams(location.search);

    return (
      params.get("limparPatrocinador") === "1" ||
      params.get("patrocinador") === "normal" ||
      params.get("patrocinador") === "limpar"
    );
  } catch (error) {
    console.log("Erro ao verificar limpeza de patrocinador:", error);
    return false;
  }
}

function salvarCodigoPatrocinador(codigo: string) {
  const storage = getStorage();
  if (!storage) return;

  const codigoNormalizado = normalizarCodigo(codigo);

  if (codigoNormalizado) {
    storage.setItem(STORAGE_KEY, codigoNormalizado);
  }
}

function removerCodigoSalvo() {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(STORAGE_KEY);
}

const SponsorContext = createContext<SponsorContextData>({} as SponsorContextData);

export function SponsorProvider({ children }: { children: ReactNode }) {
  const [codigoPatrocinador, setCodigoPatrocinador] = useState("");

  useEffect(() => {
    const codigoUrl = normalizarCodigo(lerParametroPatrocinador());
    const pediuLimpeza = urlPediuLimpeza();

    // Regra nova:
    // - Só mostra patrocinador quando o link tiver ?patrocinador=aura
    // - Link normal, sem patrocinador, volta para o app normal
    // - Evita o problema de ficar preso no modelo Aura depois do teste
    if (pediuLimpeza || !codigoUrl) {
      setCodigoPatrocinador("");
      removerCodigoSalvo();
      return;
    }

    if (PATROCINADORES[codigoUrl]) {
      setCodigoPatrocinador(codigoUrl);
      salvarCodigoPatrocinador(codigoUrl);
      return;
    }

    setCodigoPatrocinador("");
    removerCodigoSalvo();
  }, []);

  const patrocinador = useMemo(() => {
    return PATROCINADORES[codigoPatrocinador] || null;
  }, [codigoPatrocinador]);

  function setPatrocinadorManual(codigo: string) {
    const codigoNormalizado = normalizarCodigo(codigo);

    if (!PATROCINADORES[codigoNormalizado]) return;

    setCodigoPatrocinador(codigoNormalizado);
    salvarCodigoPatrocinador(codigoNormalizado);
  }

  function limparPatrocinador() {
    setCodigoPatrocinador("");
    removerCodigoSalvo();
  }

  return (
    <SponsorContext.Provider
      value={{
        patrocinador,
        temPatrocinador: Boolean(patrocinador),
        codigoPatrocinador,
        setPatrocinadorManual,
        limparPatrocinador,
      }}
    >
      {children}
    </SponsorContext.Provider>
  );
}

export function useSponsor() {
  return useContext(SponsorContext);
}
