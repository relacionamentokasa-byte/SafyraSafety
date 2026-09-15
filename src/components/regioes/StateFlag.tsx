import React from 'react';
import { cn } from '@/lib/utils';

interface StateFlagProps {
  uf: string;
  className?: string;
  name?: string;
}

/**
 * Componente vetorial autônomo com as bandeiras dos 26 estados brasileiros + DF.
 * Renderiza SVG nativo inline, sem depender de rede externa ou imagens externas quebradas.
 */
export function StateFlag({ uf, className, name }: StateFlagProps) {
  const code = (uf || '').toUpperCase();

  const renderSvg = () => {
    switch (code) {
      // Goiás: listras verdes e amarelas horizontais com retângulo azul no canto superior esquerdo e 5 estrelas brancas (Cruzeiro do Sul)
      case 'GO':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="8.75" y="0" fill="#009245" />
            <rect width="100" height="8.75" y="8.75" fill="#FED100" />
            <rect width="100" height="8.75" y="17.5" fill="#009245" />
            <rect width="100" height="8.75" y="26.25" fill="#FED100" />
            <rect width="100" height="8.75" y="35" fill="#009245" />
            <rect width="100" height="8.75" y="43.75" fill="#FED100" />
            <rect width="100" height="8.75" y="52.5" fill="#009245" />
            <rect width="100" height="8.75" y="61.25" fill="#FED100" />
            <rect width="40" height="35" fill="#002B7F" />
            {/* Cruzeiro do Sul */}
            <circle cx="20" cy="10" r="2.2" fill="#FFFFFF" />
            <circle cx="20" cy="25" r="2.2" fill="#FFFFFF" />
            <circle cx="13" cy="18" r="2.2" fill="#FFFFFF" />
            <circle cx="27" cy="16" r="2.2" fill="#FFFFFF" />
            <circle cx="22" cy="20" r="1.4" fill="#FFFFFF" />
          </svg>
        );

      // Pará: fundo vermelho com faixa diagonal branca e estrela azul central
      case 'PA':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#D21034" />
            <polygon points="0,0 22,0 100,50 100,70 78,70 0,20" fill="#FFFFFF" />
            <polygon points="50,25 53,32 60,33 55,38 56,45 50,41 44,45 45,38 40,33 47,32" fill="#002B7F" />
          </svg>
        );

      // São Paulo: 13 listras pretas e brancas com cantão vermelho e mapa/círculo
      case 'SP':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <rect key={i} width="100" height={70 / 13} y={(i * 70) / 13} fill={i % 2 === 0 ? '#111827' : '#FFFFFF'} />
            ))}
            <rect width="38" height="35" fill="#D21034" />
            <circle cx="19" cy="17.5" r="11" fill="#FFFFFF" />
            <circle cx="19" cy="17.5" r="8" fill="#002B7F" />
            <circle cx="6" cy="6" r="1.8" fill="#FED100" />
            <circle cx="32" cy="6" r="1.8" fill="#FED100" />
            <circle cx="6" cy="29" r="1.8" fill="#FED100" />
            <circle cx="32" cy="29" r="1.8" fill="#FED100" />
          </svg>
        );

      // Minas Gerais: fundo branco com triângulo vermelho central
      case 'MG':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <polygon points="50,15 76,55 24,55" fill="#D21034" />
          </svg>
        );

      // Rio de Janeiro: esquartelado em branco e azul com brasão no centro
      case 'RJ':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="50" height="35" x="0" y="0" fill="#FFFFFF" />
            <rect width="50" height="35" x="50" y="0" fill="#3B82F6" />
            <rect width="50" height="35" x="0" y="35" fill="#3B82F6" />
            <rect width="50" height="35" x="50" y="35" fill="#FFFFFF" />
            <circle cx="50" cy="35" r="14" fill="#FFFFFF" stroke="#002B7F" strokeWidth="1.5" />
            <circle cx="50" cy="35" r="8" fill="#10B981" />
            <circle cx="50" cy="35" r="4" fill="#FED100" />
          </svg>
        );

      // Bahia: listras brancas e azuis com cantão vermelho e triângulo branco
      case 'BA':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="17.5" y="0" fill="#FFFFFF" />
            <rect width="100" height="17.5" y="17.5" fill="#002B7F" />
            <rect width="100" height="17.5" y="35" fill="#FFFFFF" />
            <rect width="100" height="17.5" y="52.5" fill="#002B7F" />
            <rect width="40" height="35" fill="#D21034" />
            <polygon points="20,8 33,28 7,28" fill="#FFFFFF" />
          </svg>
        );

      // Paraná: fundo verde com faixa diagonal branca e círculo azul com cruzeiro
      case 'PR':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#009245" />
            <polygon points="0,0 20,0 100,52 100,70 80,70 0,18" fill="#FFFFFF" />
            <circle cx="50" cy="35" r="14" fill="#002B7F" />
            <circle cx="50" cy="27" r="1.5" fill="#FFFFFF" />
            <circle cx="50" cy="43" r="1.5" fill="#FFFFFF" />
            <circle cx="43" cy="35" r="1.5" fill="#FFFFFF" />
            <circle cx="57" cy="33" r="1.5" fill="#FFFFFF" />
            <circle cx="52" cy="38" r="1" fill="#FFFFFF" />
          </svg>
        );

      // Rio Grande do Sul: três faixas diagonais (verde, vermelho, amarelo)
      case 'RS':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <polygon points="0,0 100,0 0,70" fill="#009245" />
            <polygon points="100,0 100,70 0,70" fill="#FED100" />
            <polygon points="0,35 60,0 100,35 40,70" fill="#D21034" />
            <ellipse cx="50" cy="35" rx="14" ry="12" fill="#FFFFFF" stroke="#002B7F" strokeWidth="0.8" />
          </svg>
        );

      // Santa Catarina: faixas vermelha, branca, vermelha com losango verde
      case 'SC':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="23.3" y="0" fill="#D21034" />
            <rect width="100" height="23.3" y="23.3" fill="#FFFFFF" />
            <rect width="100" height="23.3" y="46.6" fill="#D21034" />
            <polygon points="50,15 78,35 50,55 22,35" fill="#009245" />
            <polygon points="50,22 59,35 50,48 41,35" fill="#FED100" />
          </svg>
        );

      // Distrito Federal: fundo branco com cruz de Brasília em verde e amarelo
      case 'DF':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="1" />
            <rect width="14" height="14" x="43" y="28" fill="#009245" />
            <polygon points="50,12 55,24 45,24" fill="#FED100" />
            <polygon points="50,58 55,46 45,46" fill="#FED100" />
            <polygon points="26,35 38,30 38,40" fill="#FED100" />
            <polygon points="74,35 62,30 62,40" fill="#FED100" />
          </svg>
        );

      // Mato Grosso: fundo azul com losango branco e círculo verde com estrela amarela
      case 'MT':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#002B7F" />
            <polygon points="50,8 90,35 50,62 10,35" fill="#FFFFFF" />
            <circle cx="50" cy="35" r="16" fill="#009245" />
            <polygon points="50,22 53,30 62,31 55,37 57,45 50,40 43,45 45,37 38,31 47,30" fill="#FED100" />
          </svg>
        );

      // Mato Grosso do Sul: fundo azul e verde cortado em diagonal com faixa branca e estrela
      case 'MS':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <polygon points="0,0 100,0 0,70" fill="#002B7F" />
            <polygon points="100,0 100,70 0,70" fill="#009245" />
            <polygon points="0,70 100,0 100,12 15,70" fill="#FFFFFF" />
            <polygon points="82,45 84,51 90,52 85,56 87,62 82,58 77,62 79,56 74,52 80,51" fill="#FED100" />
          </svg>
        );

      // Espírito Santo: três faixas horizontais azul claro, branco e rosa
      case 'ES':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="23.3" y="0" fill="#38BDF8" />
            <rect width="100" height="23.3" y="23.3" fill="#FFFFFF" />
            <rect width="100" height="23.3" y="46.6" fill="#F472B6" />
          </svg>
        );

      // Ceará: fundo verde com losango amarelo e brasão no centro
      case 'CE':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#009245" />
            <polygon points="50,8 90,35 50,62 10,35" fill="#FED100" />
            <circle cx="50" cy="35" r="14" fill="#FFFFFF" stroke="#002B7F" strokeWidth="1" />
            <polygon points="50,26 53,32 60,33 55,38 56,44 50,40 44,44 45,38 40,33 47,32" fill="#002B7F" />
          </svg>
        );

      // Pernambuco: azul superior com arco-íris, sol e cruz; branco inferior com estrela
      case 'PE':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="35" y="0" fill="#002B7F" />
            <rect width="100" height="35" y="35" fill="#FFFFFF" />
            {/* Arco-íris */}
            <circle cx="50" cy="35" r="24" fill="none" stroke="#D21034" strokeWidth="2.5" />
            <circle cx="50" cy="35" r="21.5" fill="none" stroke="#FED100" strokeWidth="2.5" />
            <circle cx="50" cy="35" r="19" fill="none" stroke="#009245" strokeWidth="2.5" />
            <circle cx="50" cy="35" r="10" fill="#FED100" />
            <polygon points="50,44 52,50 58,50 53,54 55,60 50,56 45,60 47,54 42,50 48,50" fill="#D21034" />
          </svg>
        );

      // Maranhão: faixas horizontais vermelho, branco, preto com cantão azul e estrela
      case 'MA':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
              const colors = ['#D21034', '#FFFFFF', '#111827'];
              return <rect key={i} width="100" height={70 / 9} y={(i * 70) / 9} fill={colors[i % 3]} />;
            })}
            <rect width="36" height="32" fill="#002B7F" />
            <polygon points="18,8 21,15 28,16 23,21 24,28 18,24 12,28 13,21 8,16 15,15" fill="#FFFFFF" />
          </svg>
        );

      // Tocantins: faixas diagonais azul, branco, amarelo com sol estilizado
      case 'TO':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <polygon points="0,0 100,0 0,70" fill="#002B7F" />
            <polygon points="100,0 100,70 0,70" fill="#FED100" />
            <polygon points="0,48 68,0 100,22 32,70" fill="#FFFFFF" />
            <circle cx="50" cy="35" r="9" fill="#FED100" />
            <polygon points="50,18 53,27 62,27 55,33 58,42 50,37 42,42 45,33 38,27 47,27" fill="#FED100" />
          </svg>
        );

      // Amazonas: faixa branca com 25 estrelas e duas faixas vermelha e azul
      case 'AM':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="23.3" y="0" fill="#FFFFFF" />
            <rect width="100" height="23.3" y="23.3" fill="#D21034" />
            <rect width="100" height="23.3" y="46.6" fill="#002B7F" />
            <rect width="36" height="23.3" fill="#002B7F" />
            <polygon points="18,4 20,9 25,10 21,14 22,19 18,16 14,19 15,14 11,10 16,9" fill="#FFFFFF" />
          </svg>
        );

      // Acre: cortada em diagonal verde e amarelo com estrela vermelha no canto
      case 'AC':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <polygon points="0,0 100,0 0,70" fill="#FED100" />
            <polygon points="100,0 100,70 0,70" fill="#009245" />
            <polygon points="18,8 21,15 28,16 23,21 24,28 18,24 12,28 13,21 8,16 15,15" fill="#D21034" />
          </svg>
        );

      // Alagoas: faixas verticais vermelho, branco, azul com brasão
      case 'AL':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="33.3" height="70" x="0" fill="#D21034" />
            <rect width="33.3" height="70" x="33.3" fill="#FFFFFF" />
            <rect width="33.3" height="70" x="66.6" fill="#002B7F" />
            <circle cx="50" cy="35" r="9" fill="#FED100" />
          </svg>
        );

      // Paraíba: terço esquerdo preto, restante vermelho com palavra NEGO estilizada
      case 'PB':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="33.3" height="70" x="0" fill="#111827" />
            <rect width="66.7" height="70" x="33.3" fill="#D21034" />
            <text x="66.6" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="900" fontFamily="sans-serif">
              NÉGO
            </text>
          </svg>
        );

      // Rio Grande do Norte: faixas verde e branca com brasão
      case 'RN':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="35" y="0" fill="#009245" />
            <rect width="100" height="35" y="35" fill="#FFFFFF" />
            <polygon points="50,15 72,35 50,55 28,35" fill="#FED100" />
            <circle cx="50" cy="35" r="9" fill="#002B7F" />
          </svg>
        );

      // Piauí: faixas verde e amarela com cantão azul e estrela
      case 'PI':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <rect key={i} width="100" height={70 / 8} y={(i * 70) / 8} fill={i % 2 === 0 ? '#009245' : '#FED100'} />
            ))}
            <rect width="36" height="35" fill="#002B7F" />
            <polygon points="18,8 21,16 29,17 23,22 25,30 18,25 11,30 13,22 7,17 15,16" fill="#FFFFFF" />
          </svg>
        );

      // Sergipe: faixas verde e amarela com cantão azul e 5 estrelas
      case 'SE':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="17.5" y="0" fill="#009245" />
            <rect width="100" height="17.5" y="17.5" fill="#FED100" />
            <rect width="100" height="17.5" y="35" fill="#009245" />
            <rect width="100" height="17.5" y="52.5" fill="#FED100" />
            <rect width="36" height="35" fill="#002B7F" />
            <polygon points="18,8 20,13 25,14 21,18 22,23 18,20 14,23 15,18 11,14 16,13" fill="#FFFFFF" />
          </svg>
        );

      // Rondônia: metade superior azul, inferior verde, triângulo amarelo e estrela
      case 'RO':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="35" y="0" fill="#002B7F" />
            <rect width="100" height="35" y="35" fill="#009245" />
            <polygon points="0,0 50,35 0,70" fill="#FED100" />
            <polygon points="50,22 53,29 60,30 55,35 56,42 50,38 44,42 45,35 40,30 47,29" fill="#FFFFFF" />
          </svg>
        );

      // Roraima: três faixas diagonais azul, branco e verde com estrela amarela
      case 'RR':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <polygon points="0,0 100,0 0,70" fill="#002B7F" />
            <polygon points="100,0 100,70 0,70" fill="#009245" />
            <polygon points="0,60 85,0 100,10 15,70" fill="#FFFFFF" />
            <polygon points="50,20 53,28 62,29 55,35 57,43 50,38 43,43 45,35 38,29 47,28" fill="#FED100" />
          </svg>
        );

      // Amapá: faixa verde, amarelo, azul, branco com fortaleza de Macapá
      case 'AP':
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="30" y="0" fill="#009245" />
            <rect width="100" height="10" y="30" fill="#FED100" />
            <rect width="100" height="30" y="40" fill="#002B7F" />
            <rect width="20" height="20" x="10" y="25" fill="#FFFFFF" stroke="#111827" strokeWidth="1" />
          </svg>
        );

      // Fallback Brasil
      default:
        return (
          <svg viewBox="0 0 100 70" className="w-full h-full">
            <rect width="100" height="70" fill="#009245" />
            <polygon points="50,8 90,35 50,62 10,35" fill="#FED100" />
            <circle cx="50" cy="35" r="14" fill="#002B7F" />
          </svg>
        );
    }
  };

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center overflow-hidden rounded shadow-2xs border border-slate-300/80 bg-slate-100 shrink-0 select-none",
        className || "h-6 w-9"
      )}
      title={name ? `Bandeira de ${name} (${code})` : `Bandeira (${code})`}
      aria-label={name ? `Bandeira de ${name}` : `Bandeira de ${code}`}
    >
      {renderSvg()}
    </div>
  );
}
