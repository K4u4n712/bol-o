import { Alert, Platform } from "react-native";

export function mostrarAlerta(titulo: string, mensagem?: string) {
  if (Platform.OS === "web") {
    window.alert(mensagem ? `${titulo}\n\n${mensagem}` : titulo);
    return;
  }

  Alert.alert(titulo, mensagem);
}

export function mostrarConfirmacao(
  titulo: string,
  mensagem: string,
  aoConfirmar: () => void
) {
  if (Platform.OS === "web") {
    const confirmou = window.confirm(`${titulo}\n\n${mensagem}`);

    if (confirmou) {
      aoConfirmar();
    }

    return;
  }

  Alert.alert(titulo, mensagem, [
    {
      text: "Cancelar",
      style: "cancel",
    },
    {
      text: "Confirmar",
      style: "destructive",
      onPress: aoConfirmar,
    },
  ]);
}