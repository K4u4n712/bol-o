const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Inicializa o acesso de administrador ao seu banco de dados
admin.initializeApp();

// Cria a rota (URL) que a InfinitePay vai chamar
exports.webhookInfinitepay = functions.https.onRequest(async (req, res) => {
  try {
    // req.body contém os dados que a InfinitePay enviou (o JSON do pagamento)
    const payload = req.body;

    // 1. Verifica se o pagamento foi realmente aprovado
    // (Atenção: confirme na documentação da InfinitePay se a palavra é "approved" ou "paid")
    if (payload.status === "approved" || payload.state === "paid") {
      
      // 2. Pega o identificador e o valor que configuramos lá no App
      const identificadorUsuario = payload.reference_id; // Esse é o carimbo que fizemos!
      const valorDepositado = Number(payload.amount);

      if (identificadorUsuario && valorDepositado > 0) {
        
        // 3. Atualiza o saldo no Firebase automaticamente
        // IMPORTANTE: Altere "usuarios" para o nome exato da sua coleção de usuários no Firebase
        const userRef = admin.firestore().collection("usuarios").doc(identificadorUsuario);
        
        await userRef.update({
          saldo: admin.firestore.FieldValue.increment(valorDepositado)
        });

        console.log(`SUCESSO: R$ ${valorDepositado} adicionado para o usuário ${identificadorUsuario}`);
      }
    }

    // 4. Sempre responda com status 200 para a InfinitePay saber que deu certo 
    // e parar de reenviar a notificação
    res.status(200).send("Webhook processado com sucesso");

  } catch (error) {
    console.error("Erro ao processar o webhook:", error);
    res.status(500).send("Erro interno no servidor");
  }
});