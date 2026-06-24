import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  Switch,
  Image,
  StatusBar
} from 'react-native';

// --- DADOS FAKES (MOCK) PARA TESTAR O LAYOUT ---
// Depois, isso virá da API da ESPN/Firebase
const MOCK_JOGOS = [
  {
    id: '1',
    data: '21/06/2026',
    horario: '20:00',
    status: 'AO_VIVO', // AO_VIVO, AGENDADO, FINALIZADO
    placarCasa: 1,
    placarFora: 0,
    timeCasa: { nome: 'New Zealand', sigla: 'NZL', bandeira: 'https://flagcdn.com/w320/nz.png' },
    timeFora: { nome: 'Egypt', sigla: 'EGY', bandeira: 'https://flagcdn.com/w320/eg.png' },
    apostasFechadas: true,
    totalApostas: 0,
  },
  {
    id: '2',
    data: '22/06/2026',
    horario: '14:00',
    status: 'AGENDADO',
    placarCasa: null,
    placarFora: null,
    timeCasa: { nome: 'Argentina', sigla: 'ARG', bandeira: 'https://flagcdn.com/w320/ar.png' },
    timeFora: { nome: 'Austria', sigla: 'AUT', bandeira: 'https://flagcdn.com/w320/at.png' },
    apostasFechadas: false,
    totalApostas: 15,
  }
];

export default function GerenciarApostasScreen() {
  const [jogos, setJogos] = useState(MOCK_JOGOS);

  // Função para alternar o toggle de "Apostas Fechadas"
  const toggleApostas = (id: string) => {
    setJogos(jogos.map(jogo => 
      jogo.id === id ? { ...jogo, apostasFechadas: !jogo.apostasFechadas } : jogo
    ));
  };

  const renderCardJogo = ({ item }: { item: any }) => {
    const isAoVivo = item.status === 'AO_VIVO';

    return (
      <View style={[styles.card, isAoVivo ? styles.cardBorderAoVivo : styles.cardBorderAgendado]}>
        {/* Cabeçalho do Card */}
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
            <View style={item.apostasFechadas ? styles.radioFechado : styles.radioAberto} />
            <Text style={styles.statusText}>{item.apostasFechadas ? 'Fechado' : 'Aberto'}</Text>
          </View>
        </View>

        {/* Placar / Times */}
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

        {/* Toggle de Apostas */}
        <View style={styles.toggleContainer}>
          <Text style={styles.toggleLabel}>Apostas Fechadas</Text>
          <Switch 
            value={item.apostasFechadas}
            onValueChange={() => toggleApostas(item.id)}
            trackColor={{ false: "#D1D5DB", true: "#006B2E" }}
            thumbColor={"#FFFFFF"}
          />
        </View>

        {/* Rodapé do Card */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>👥 {item.totalApostas} aposta(s)</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F4F6F9" />
      
      {/* HEADER DA TELA */}
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

      {/* LISTA DE JOGOS */}
      <FlatList
        data={jogos}
        keyExtractor={(item) => item.id}
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
    paddingBottom: 100, // Espaço para o menu inferior não sobrepor
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
    borderLeftColor: '#EF4444', // Vermelho para ao vivo
  },
  cardBorderAgendado: {
    borderLeftColor: '#00C4B4', // Ciano/Verde para agendado
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
    resizeMode: 'cover',
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