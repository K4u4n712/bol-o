import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  Image,
  StatusBar,
  ActivityIndicator,
  TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Redirect, router } from 'expo-router';
import { db } from '../../services/firebaseConfig';
import { doc, setDoc, getDocs, collection } from 'firebase/firestore';

export default function GerenciarApostasScreen() {
  const { user } = useAuth();
  
  const [jogos, setJogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. TRAVA DE SEGURANÇA: Apenas administradores podem acessar
  // Substitua o email abaixo pelo seu email real de admin
  if (user?.email !== "admin@bolao.com") {
    return <Redirect href="/" />;
  }

  // 2. PUXAR DADOS DA ESPN (Com filtros de data e Firebase)
  useEffect(() => {
    const buscarJogos = async () => {
      try {
        const agora = new Date();
        const limite48h = new Date(agora.getTime() + (48 * 60 * 60 * 1000));

        // Formata a data para YYYYMMDD (padrão exigido pela API da ESPN)
        const fData = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const urlESPN = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${fData(agora)}-${fData(limite48h)}`;

        const response = await fetch(urlESPN);
        const data = await response.json();

        // Busca o status salvo no Firebase para saber se o Admin já fechou alguma aposta
        const statusSnapshot = await getDocs(collection(db, "status_apostas"));
        const statusFirebase: Record<string, boolean> = {};
        statusSnapshot.forEach(docSnap => {
          statusFirebase[docSnap.id] = docSnap.data().aberta;
        });

        const jogosFiltrados = data.events.reduce((acc: any[], event: any) => {
          const dataJogo = new Date(event.date);
          const status = event.status.type.state; // 'pre' (agendado), 'in' (ao vivo), 'post' (finalizado)
          const competidores = event.competitions[0].competitors;
          const timeCasa = competidores.find((c: any) => c.homeAway === 'home');
          const timeFora = competidores.find((c: any) => c.homeAway === 'away');

          // Não mostrar jogos além de 48 horas no futuro
          if (dataJogo > limite48h) return acc;

          // Sumir com o jogo 30 min (aprox) após terminar (9.000.000 ms)
          if (status === 'post') {
            const tempoDesdeInicio = agora.getTime() - dataJogo.getTime();
            if (tempoDesdeInicio > 9000000) {
              return acc; 
            }
          }

          let statusBR = 'AGENDADO';
          if (status === 'in') statusBR = 'AO_VIVO';
          if (status === 'post') statusBR = 'FINALIZADO';

          // Checa se já existe um registro no Firebase forçando a abertura/fechamento
          const jaTemStatusNoFirebase = statusFirebase[event.id] !== undefined;

          acc.push({
            id: event.id,
            data: dataJogo.toLocaleDateString('pt-BR'),
            horario: dataJogo.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            status: statusBR,
            placarCasa: timeCasa.score,
            placarFora: timeFora.score,
            timeCasa: { 
              nome: timeCasa.team.displayName, 
              sigla: timeCasa.team.abbreviation, 
              bandeira: timeCasa.team.logo || 'https://via.placeholder.com/50' 
            },
            timeFora: { 
              nome: timeFora.team.displayName, 
              sigla: timeFora.team.abbreviation, 
              bandeira: timeFora.team.logo || 'https://via.placeholder.com/50' 
            },
            // Se o admin mexeu, usa do Firebase. Se não, usa o padrão da ESPN ('pre' = aberto)
            apostasAbertas: jaTemStatusNoFirebase ? statusFirebase[event.id] : (status === 'pre'),
            totalApostas: 0,
          });

          return acc;
        }, []);

        setJogos(jogosFiltrados);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar jogos:", error);
        setLoading(false);
      }
    };

    buscarJogos();
    const interval = setInterval(buscarJogos, 60000); // Atualiza placar e dados a cada 1 min
    return () => clearInterval(interval);
  }, []);

  // 3. PERSISTIR LÓGICA DO TOGGLE NO FIREBASE
  const toggleApostas = async (id: string) => {
    const jogoAtual = jogos.find(j => j.id === id);
    if (!jogoAtual) return;
    
    const novoStatus = !jogoAtual.apostasAbertas;

    // Atualiza a interface instantaneamente para o usuário não sentir travamento
    setJogos(jogos.map(jogo => 
      jogo.id === id ? { ...jogo, apostasAbertas: novoStatus } : jogo
    ));

    // Salva a decisão no banco de dados
    try {
      const jogoRef = doc(db, "status_apostas", id.toString());
      await setDoc(jogoRef, { aberta: novoStatus }, { merge: true });
    } catch (error) {
      console.error("Erro ao salvar no Firebase:", error);
    }
  };

  const renderCardJogo = ({ item }: { item: any }) => {
    const isAoVivo = item.status === 'AO_VIVO';

    return (
      <View style={[styles.card, isAoVivo ? styles.cardBorderAoVivo : styles.cardBorderAgendado]}>
        
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.dataText}>{item.data}</Text>
            {isAoVivo ? (
              <Text style={styles.badgeAoVivo}>📺 AO VIVO</Text>
            ) : (
              <Text style={styles.badgeAgendado}>📅 AGENDADO</Text>
            )}
          </View>
          
          <View style={styles.statusRadio}>
            <View style={item.apostasAbertas ? styles.radioAberto : styles.radioFechado} />
            <Text style={styles.statusText}>{item.apostasAbertas ? 'Aberto' : 'Fechado'}</Text>
          </View>
        </View>

        <View style={styles.matchRow}>
          <View style={styles.teamContainer}>
            <Image source={{ uri: item.timeCasa.bandeira }} style={styles.flag} />
            <Text style={styles.teamName}>{item.timeCasa.nome}</Text>
          </View>

          <View style={styles.scoreContainer}>
            {isAoVivo || item.status === 'FINALIZADO' ? (
              <Text style={styles.scoreText}>{item.placarCasa} - {item.placarFora}</Text>
            ) : (
              <>
                <Text style={styles.vsText}>VS</Text>
                <Text style={styles.timeText}>{item.horario}</Text>
              </>
            )}
          </View>

          <View style={styles.teamContainer}>
            <Image source={{ uri: item.timeFora.bandeira }} style={styles.flag} />
            <Text style={styles.teamName}>{item.timeFora.nome}</Text>
          </View>
        </View>

        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Apostas Abertas</Text>
          <Switch 
            value={item.apostasAbertas}
            onValueChange={() => toggleApostas(item.id)}
            trackColor={{ false: "#D1D5DB", true: "#006B2E" }}
            thumbColor={"#FFFFFF"}
          />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>👥 {item.totalApostas} aposta(s)</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#006B2E" />
        <Text style={{ marginTop: 12, color: '#006B2E', fontWeight: 'bold' }}>Buscando jogos oficiais...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F9" />
      
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <Text style={styles.headerIcon}>📚</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Gerenciar Rodada Copa 2026</Text>
          <Text style={styles.headerSubtitle}>Inteligência de exibição em tempo real</Text>
        </View>
      </View>

      <Text style={styles.listTitle}>☰ Gerenciamento ({jogos.length})</Text>

      <FlatList
        data={jogos}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCardJogo}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* 4. MENU INFERIOR REINSERIDO */}
      <View style={styles.bottomMenu}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/")}>
          <Text style={styles.menuIcon}>🏠</Text>
          <Text style={styles.menuText}>Início</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/apostar")}>
          <Text style={styles.menuIcon}>🎯</Text>
          <Text style={styles.menuText}>Apostar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/bolao")}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Bolão</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/ranking")}>
          <Text style={styles.menuIcon}>🏆</Text>
          <Text style={styles.menuText}>Ranking</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItemActive}>
          <Text style={styles.menuIcon}>⚙️</Text>
          <Text style={styles.menuTextActive}>Gerenciar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/perfil")}>
          <Text style={styles.menuIcon}>👤</Text>
          <Text style={styles.menuText}>Perfil</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F9',
  },
  header: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    margin: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    borderLeftWidth: 6,
    borderLeftColor: '#006B2E',
  },
  headerIconContainer: {
    marginRight: 12,
  },
  headerIcon: {
    fontSize: 28,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#006B2E',
    maxWidth: '90%',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#006B2E',
    marginLeft: 20,
    marginBottom: 10,
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100, 
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    elevation: 3,
    borderLeftWidth: 5,
    overflow: 'hidden',
  },
  cardBorderAoVivo: {
    borderLeftColor: '#EF4444', 
  },
  cardBorderAgendado: {
    borderLeftColor: '#00C4B4', 
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    paddingBottom: 0,
  },
  dataText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  badgeAoVivo: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '900',
    marginTop: 4,
  },
  badgeAgendado: {
    fontSize: 12,
    color: '#00C4B4',
    fontWeight: '900',
    marginTop: 4,
  },
  statusRadio: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioFechado: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#D1D5DB',
    marginRight: 6,
  },
  radioAberto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#006B2E',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '700',
  },
  matchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 15,
  },
  teamContainer: {
    alignItems: 'center',
    width: 80,
  },
  flag: {
    width: 50,
    height: 35,
    borderRadius: 6,
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  teamName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#111827',
    marginTop: 8,
    textAlign: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#006B2E',
  },
  vsText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#006B2E',
  },
  timeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#006B2E',
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 12,
    borderRadius: 12,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 12,
    marginTop: 16,
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginLeft: 10,
  },
  
  // ESTILOS DO MENU INFERIOR
  bottomMenu: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 78,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingBottom: 10,
  },
  menuItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  menuItemActive: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  menuIcon: {
    fontSize: 22,
  },
  menuText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 3,
    fontWeight: "700",
  },
  menuTextActive: {
    fontSize: 11,
    color: "#00A344",
    marginTop: 3,
    fontWeight: "900",
  },
});