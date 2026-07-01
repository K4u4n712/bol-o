import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

export type Patrocinador = {
  id: string;
  nome: string;
  nomeCurto: string;
  instagram?: string;
  logoUri?: string;
  logoIniciais: string;
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
    logoIniciais: "AL",
    logoUri: "data:image/jpeg;base64,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",
    corPrimaria: "#CDA24E",
    corSecundaria: "#123522",
    corFundo: "#F7F3EA",
    corTexto: "#111827",
    corCard: "#FFFFFF",
    descricao: "Experiência premium com oferecimento da Aura Lounge.",
    avisoQr: "Oferecimento Aura Lounge",
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

function lerCodigoSalvo() {
  const storage = getStorage();
  if (!storage) return "";

  return normalizarCodigo(storage.getItem(STORAGE_KEY));
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

function pegarTipoNavegacao() {
  try {
    if (Platform.OS !== "web") return "";

    const performanceRef = (globalThis as any)?.performance;
    const entradas = performanceRef?.getEntriesByType?.("navigation") || [];
    const tipo = entradas?.[0]?.type;

    return String(tipo || "");
  } catch (error) {
    console.log("Erro ao verificar tipo de navegação:", error);
    return "";
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
    const codigoSalvo = lerCodigoSalvo();
    const tipoNavegacao = pegarTipoNavegacao();

    if (pediuLimpeza) {
      setCodigoPatrocinador("");
      removerCodigoSalvo();
      return;
    }

    // Link de patrocinador sempre ativa e salva.
    // Exemplo: /?patrocinador=aura
    if (codigoUrl && PATROCINADORES[codigoUrl]) {
      setCodigoPatrocinador(codigoUrl);
      salvarCodigoPatrocinador(codigoUrl);
      return;
    }

    // Link com código inválido limpa para evitar patrocinador errado.
    if (codigoUrl && !PATROCINADORES[codigoUrl]) {
      setCodigoPatrocinador("");
      removerCodigoSalvo();
      return;
    }

    // Sem parâmetro:
    // - se foi atualização da página, mantém a Aura salva;
    // - se a pessoa digitou/abriu o link normal, volta para o modelo normal.
    if (Platform.OS === "web") {
      if (
        (tipoNavegacao === "reload" || tipoNavegacao === "back_forward") &&
        codigoSalvo &&
        PATROCINADORES[codigoSalvo]
      ) {
        setCodigoPatrocinador(codigoSalvo);
        return;
      }

      setCodigoPatrocinador("");
      removerCodigoSalvo();
      return;
    }

    if (codigoSalvo && PATROCINADORES[codigoSalvo]) {
      setCodigoPatrocinador(codigoSalvo);
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
