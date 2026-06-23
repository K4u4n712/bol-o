import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  getDoc,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "../services/firebaseConfig";

type User = {
  nome: string;
  email: string;
  senha: string;
  saldo: number;
  role: "user" | "admin";
  banido?: boolean;
  uid?: string;
};

type LoggedUser = {
  nome: string;
  email: string;
  saldo: number;
  role: "user" | "admin";
  banido?: boolean;
  uid?: string;
};

type AuthContextData = {
  user: LoggedUser | null;
  loading: boolean;
  users: User[];
  login: (email: string, senha: string) => Promise<void>;
  register: (nome: string, email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
  carregarUsuarios: () => Promise<void>;
  atualizarSaldoUsuario: (email: string, novoSaldo: number) => Promise<void>;
  banirUsuario: (email: string) => Promise<void>;
  desbanirUsuario: (email: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

const ADMIN_EMAIL = "admin@bolao.com";
const ADMIN_SENHA = "admin123";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LoggedUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  function formatarUsuario(id: string, data: any): User {
    return {
      uid: id,
      nome: data.nome || "",
      email: data.email || "",
      senha: "",
      saldo: Number(data.saldo || 0),
      role: data.role || "user",
      banido: data.banido || false,
    };
  }

  async function buscarUsuarioPorEmail(email: string) {
    const usuariosRef = collection(db, "users");

    const q = query(
      usuariosRef,
      where("emailLower", "==", email.toLowerCase())
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const documento = snapshot.docs[0];

    return {
      id: documento.id,
      data: documento.data(),
    };
  }

  async function criarPerfilUsuario(
    uid: string,
    nome: string,
    email: string,
    role: "user" | "admin" = "user"
  ) {
    await setDoc(doc(db, "users", uid), {
      nome,
      email,
      emailLower: email.toLowerCase(),
      saldo: 0,
      role,
      banido: false,
      criadoEm: serverTimestamp(),
    });
  }

  async function carregarPerfilUsuario(uid: string) {
    const userDoc = await getDoc(doc(db, "users", uid));

    if (!userDoc.exists()) {
      await logout();
      return;
    }

    const data = userDoc.data();

    if (data.banido) {
      await logout();
      throw new Error("Este usuário foi banido do bolão.");
    }

    const usuarioLogado: LoggedUser = {
      uid,
      nome: data.nome || "",
      email: data.email || "",
      saldo: Number(data.saldo || 0),
      role: data.role || "user",
      banido: data.banido || false,
    };

    setUser(usuarioLogado);
  }

  async function carregarUsuarios() {
    const snapshot = await getDocs(collection(db, "users"));

    const lista = snapshot.docs.map((documento) =>
      formatarUsuario(documento.id, documento.data())
    );

    lista.sort((a, b) => {
      if (a.role === "admin") return -1;
      if (b.role === "admin") return 1;
      return a.nome.localeCompare(b.nome);
    });

    setUsers(lista);
  }

  useEffect(() => {
  let unsubscribeUsuario: (() => void) | undefined;

  const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
    if (unsubscribeUsuario) {
      unsubscribeUsuario();
    }

    if (!firebaseUser) {
      setUser(null);
      setLoading(false);
      return;
    }

    const usuarioRef = doc(db, "users", firebaseUser.uid);

    unsubscribeUsuario = onSnapshot(
      usuarioRef,
      async (documento) => {
        try {
          if (!documento.exists()) {
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }

          const data = documento.data();

          if (data.banido) {
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }

          const usuarioAtualizado: LoggedUser = {
            uid: firebaseUser.uid,
            nome: data.nome || "",
            email: data.email || "",
            saldo: Number(data.saldo || 0),
            role: data.role || "user",
            banido: data.banido || false,
          };

          setUser(usuarioAtualizado);
          await carregarUsuarios();
          setLoading(false);
        } catch (error) {
          console.log("Erro ao atualizar usuário em tempo real:", error);
          setLoading(false);
        }
      },
      (error) => {
        console.log("Erro no listener do usuário:", error);
        setLoading(false);
      }
    );
  });

  return () => {
    unsubscribeAuth();

    if (unsubscribeUsuario) {
      unsubscribeUsuario();
    }
  };
}, []);

  async function login(email: string, senha: string) {
    if (!email || !senha) {
      throw new Error("Preencha e-mail e senha.");
    }

    try {
      const response = await signInWithEmailAndPassword(
        auth,
        email.toLowerCase(),
        senha
      );

      await carregarPerfilUsuario(response.user.uid);
      await carregarUsuarios();
    } catch (error: any) {
      if (
        email.toLowerCase() === ADMIN_EMAIL &&
        senha === ADMIN_SENHA
      ) {
        try {
          const response = await createUserWithEmailAndPassword(
            auth,
            ADMIN_EMAIL,
            ADMIN_SENHA
          );

          await criarPerfilUsuario(
            response.user.uid,
            "Administrador",
            ADMIN_EMAIL,
            "admin"
          );

          await carregarPerfilUsuario(response.user.uid);
          await carregarUsuarios();
          return;
        } catch (adminError: any) {
          throw new Error("Erro ao criar ou acessar o administrador.");
        }
      }

      throw new Error("E-mail ou senha incorretos.");
    }
  }

  async function register(nome: string, email: string, senha: string) {
    if (!nome || !email || !senha) {
      throw new Error("Preencha nome, e-mail e senha.");
    }

    if (senha.length < 6) {
      throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    }

    const emailExistente = await buscarUsuarioPorEmail(email);

    if (emailExistente) {
      throw new Error("Este e-mail já está cadastrado.");
    }

    try {
      const response = await createUserWithEmailAndPassword(
        auth,
        email.toLowerCase(),
        senha
      );

      await criarPerfilUsuario(response.user.uid, nome, email.toLowerCase(), "user");

      await carregarPerfilUsuario(response.user.uid);
      await carregarUsuarios();
    } catch (error: any) {
      if (error.code === "auth/email-already-in-use") {
        throw new Error("Este e-mail já está cadastrado.");
      }

      if (error.code === "auth/invalid-email") {
        throw new Error("E-mail inválido.");
      }

      throw new Error("Erro ao cadastrar usuário.");
    }
  }

  async function atualizarSaldoUsuario(email: string, novoSaldo: number) {
    const usuarioEncontrado = await buscarUsuarioPorEmail(email);

    if (!usuarioEncontrado) {
      throw new Error("Usuário não encontrado.");
    }

    await updateDoc(doc(db, "users", usuarioEncontrado.id), {
      saldo: novoSaldo,
    });

    await carregarUsuarios();

    if (user?.email.toLowerCase() === email.toLowerCase()) {
      setUser({
        ...user,
        saldo: novoSaldo,
      });
    }
  }

  async function banirUsuario(email: string) {
    const usuarioEncontrado = await buscarUsuarioPorEmail(email);

    if (!usuarioEncontrado) {
      throw new Error("Usuário não encontrado.");
    }

    const dados = usuarioEncontrado.data;

    if (dados.role === "admin") {
      throw new Error("Não é possível banir o administrador.");
    }

    await updateDoc(doc(db, "users", usuarioEncontrado.id), {
      banido: true,
    });

    await carregarUsuarios();

    if (user?.email.toLowerCase() === email.toLowerCase()) {
      await logout();
    }
  }

  async function desbanirUsuario(email: string) {
    const usuarioEncontrado = await buscarUsuarioPorEmail(email);

    if (!usuarioEncontrado) {
      throw new Error("Usuário não encontrado.");
    }

    await updateDoc(doc(db, "users", usuarioEncontrado.id), {
      banido: false,
    });

    await carregarUsuarios();
  }

  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        users,
        login,
        register,
        logout,
        carregarUsuarios,
        atualizarSaldoUsuario,
        banirUsuario,
        desbanirUsuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}