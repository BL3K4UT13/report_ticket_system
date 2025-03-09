'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';

interface Ticket {
  id: number;
  data: Date;
  titulo: string;
  categoria: string;
}

export default function Home() {
  const [data, setData] = useState<Ticket[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const fakeData: Ticket[] = [
        { id: 1, data: new Date('2024-07-26'), titulo: 'Erro de login', categoria: 'Autenticação' },
        { id: 2, data: new Date('2024-07-25'), titulo: 'Página não encontrada', categoria: 'Navegação' },
        { id: 3, data: new Date('2024-07-24'), titulo: 'Lentidão no carregamento', categoria: 'Performance' },
        { id: 4, data: new Date('2024-07-23'), titulo: 'Bug no formulário', categoria: 'Formulário' },
        { id: 5, data: new Date('2024-07-22'), titulo: 'Falha no pagamento', categoria: 'Pagamento' },
        { id: 6, data: new Date('2024-07-21'), titulo: 'Problema de conexão', categoria: 'Rede' },
        { id: 7, data: new Date('2024-07-27'), titulo: 'Erro de login 2', categoria: 'Autenticação' },
        { id: 8, data: new Date('2024-07-28'), titulo: 'Página não encontrada 2', categoria: 'Navegação' },
      ];
      setData(fakeData);
      setError(null);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      setError("Erro ao sincronizar dados. Tente novamente mais tarde.");
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categoriasSomadas = data.reduce<Record<string,number>>((acumulador, ticket) => {
    const categoria = ticket.categoria;
    if (!acumulador[categoria]) {
      acumulador[categoria] = 0;
    }
    acumulador[categoria]++;
    return acumulador;
  }, {});

  const dataParaGrafico = Object.entries(categoriasSomadas).map(([categoria, soma]) => ({
    categoria,
    soma,
  }));

  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {dateStyle: 'short'})

  return (
    <div className={clsx(
      'min-h-screen flex flex-col p-6 transition-all duration-300',
      darkMode && 'dark bg-gray-900 text-white',
      !darkMode && 'bg-gray-100 text-gray-900'
    )}>
      <div className="flex justify-between items-start w-full">
        <h1 className="text-2xl font-bold mb-4">Report Ticket System</h1>
        <label htmlFor="check" className="cursor-pointer relative w-16 h-8 flex items-center" aria-label="Alternar tema">
          <input
            type="checkbox"
            id="check"
            className="sr-only peer"
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />
          <div className="w-full h-full bg-gray-300 rounded-full peer-checked:bg-gray-800 transition-all duration-400"></div>
          <span className="absolute left-1 top-1 w-6 h-6 bg-white rounded-full peer-checked:left-9 transition-all duration-400 flex items-center justify-center">
            {darkMode ? <Moon className="w-4 h-4 text-gray-800" /> : <Sun className="w-4 h-4 text-yellow-400" />}
          </span>
        </label>
      </div>

      <div className="flex flex-col items-center justify-center w-full">
        <div className="flex gap-4 items-center">
          <button onClick={fetchData} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
            Sincronizar Dados
          </button>

          <button
            onClick={() => data.length > 0 && setIsModalOpen(true)}
            className={clsx(
              'px-4 py-2 rounded-lg',
              data.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-400 text-gray-700 cursor-not-allowed'
            )}
            disabled={data.length === 0}
          >
            Gerar Gráfico
          </button>
        </div>

        {error && (
          <div className="text-red-500 mt-4">
            {error}
          </div>
        )}

        <div className={clsx(
          darkMode ? 'dark bg-gray-800 text-white' : 'bg-white text-gray-900',
          'mt-6 w-full max-w-md p-4 rounded-lg shadow'
        )}>
          <h2 className="text-lg font-semibold mb-3">Lista de Tickets</h2>
          {data.length > 0 ? (
            <ul role="list" className="divide-y divide-gray-300 dark:divide-gray-600">
              {data.map((item) => (
                <li key={item.id} className="flex py-4 first:pt-0 last:pb-0">
                  <div className="ml-3 overflow-hidden">
                    <p className="text-sm font-medium">{item.titulo}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.categoria} - {dateFormatter.format(item.data)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível.</p>
          )}
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className={clsx(
              darkMode ? 'dark bg-gray-800 text-white' : 'bg-white text-gray-900',
              'p-6 rounded-lg shadow-lg max-w-lg w-full'
            )}>
              <h2 className="text-xl font-bold mb-4">Gráfico de Tickets</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dataParaGrafico}
                    dataKey="soma"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    label
                  >
                    <Tooltip/>
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <button
                onClick={() => setIsModalOpen(false)}
                className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type CustomTooltipProps = {
  active: boolean
  payload: {
    categoria: string
    soma: number
  }
  label: string
}
/*
const CustomTooltip = ({ active, payload, label }:CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2 rounded-md shadow-md">
        <p className="label">{payload[0].payload.categoria}</p>
        <p className="intro">{payload[0].payload.soma} tickets</p>
      </div>
    );
  }

  return null;
};
*/