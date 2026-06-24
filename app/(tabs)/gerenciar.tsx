import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Switch,
  Image,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Redirect } from 'expo-router';

export default function GerenciarApostasScreen() {
  const { user } = useAuth();
  
  const [jogos, setJogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. TRAVA DE SEGURANÇA: Apenas administradores podem acessar
  // Substitua o email abaixo pelo email de vocês
  if (user?.email !== "admin@bolao.com") {
    return <Redirect href="/" />;
  }

  // 3. PUXAR DADOS DA ESPN
  useEffect(() => {
    const buscarJogos = async () => {
      try {
        const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
        const data = await response.json();

        const agora = new Date();
        const limite48h = new Date(agora.getTime() + (48 * 60 * 60 * 1000));

        const jogosFiltrados = data.events.reduce((acc: any[], event: any) => {
          const dataJogo = new Date(event.date);
          const status = event.status.type.state; // 'pre' (agendado), 'in' (ao vivo), 'post' (finalizado)
          const competidores = event.competitions[0].competitors;
          const timeCasa = competidores.find((c: any) => c.homeAway === 'home');
          const timeFora = competidores.find((c: any) => c.homeAway === 'away');

          // Não mostrar jogos além de 48 horas no futuro
          if (dataJogo > limite48h) return acc;

          // Sumir com o jogo 30 min (aprox) após terminar
          if (status === 'post') {
            const tempoDesdeInicio = agora.getTime() - dataJogo.getTime();
            if (tempoDesdeInicio > 9000000) {
              return acc; 
            }
          }

          let statusBR = 'AGENDADO';
          if (status === 'in') statusBR = 'AO_VIVO';
          if (status === 'post') statusBR = 'FINALIZADO';

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
            apostasAbertas: status === 'pre', // 2. Lógica nova: só abre automaticamente os que não começaram
            totalApostas: 0,
          });

          return acc;
        }, []);

        setJogos(jogosFiltrados);
        setLoading(false);
      } catch (error) {
        console.error("Erro ao buscar jogos da ESPN:", error);
        setLoading(false);
      }
    };

    buscarJogos();
    const interval = setInterval(buscarJogos, 60000); // Atualiza placar a cada minuto
    return () => clearInterval(interval);
  }, []);

  // 2. LÓGICA DO TOGGLE CORRIGIDA (Apostas Abertas)
  const toggleApostas = (id: string) => {
    setJogos(jogos.map(jogo => 
      jogo.id === id ? { ...jogo, apostasAbertas: !jogo.apostasAbertas } : jogo
    ));
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
  }
});