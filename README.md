# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## Agenda de unhas em gel

A página pública fica em `/agenda-unhas` e o painel em `/agenda-unhas-admin`. Ambos são publicados com o frontend Expo. A rota `/api/agenda-unhas` é publicada com o projeto Vercel de `backend-bolao`.

Antes de publicar:

- O painel usa a conta administrativa da AirClean configurada em `AIRCLEAN_ADMIN_UID`. Para trocar de conta, defina `NAIL_STUDIO_ADMIN_UID` no backend da Vercel com o UID de outro usuário do mesmo projeto Firebase.
- No backend da Vercel, defina `NAIL_STUDIO_CONTACT_KEY` com 32 bytes aleatórios em Base64. Gere essa chave localmente em uma sessão privada e guarde uma cópia segura. Ela é necessária para ler os contatos já registrados.
- Confira nas regras publicadas do Cloud Firestore que os SDKs clientes não têm acesso aos documentos `nailStudio/settings` e `nailStudio/settings/days/{date}`. Uma permissão ampla que também abranja esses caminhos precisa ser restringida. O backend usa o Firebase Admin para acessar os documentos.
- Se o backend for publicado em outro domínio, configure `EXPO_PUBLIC_NAIL_STUDIO_API` no frontend com a origem dele, sem barra final.
- Depois do deploy dos dois projetos, entre no painel, revise os serviços e abra os dias de atendimento. Teste uma reserva antes de compartilhar o link.

Os dias começam fechados. A página pública oferece reservas para até 60 dias no fuso de São Paulo. O primeiro serviço é Unhas em gel, com duração inicial de 90 minutos, editável no painel.
