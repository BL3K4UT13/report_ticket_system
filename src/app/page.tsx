'use client';

import { useState, useEffect } from 'react';
import {
    PieChart,
    Pie,
    ResponsiveContainer,
    Tooltip,
    PieProps,
    Sector,
    Label,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    // Legend, // Removido o import da Legend
} from 'recharts';
import { Moon, Sun, Ticket } from 'lucide-react';
import clsx from 'clsx';

interface Ticket {
    id: number;
    data: Date;
    categoria: string;
    subcategoria: string;
}

interface PieChartData {
    name: string;
    soma: number;
}

interface CustomTooltipItem {
    dataKey: string;
    name: string;
    payload: PieChartData;
    unit?: string | number;
    value: number;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: CustomTooltipItem[];
    name?: string | number;
    total?: number;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, total }) => {
    console.log("Payload:", payload);
    if (active && payload && payload.length > 0 && typeof total === 'number') {
        const data = payload[0].payload;
        const percentage = ((data.soma / total) * 100).toFixed(2);

        return (
            <div className="bg-white p-2 rounded shadow-md text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                <p className="font-semibold">{data.name}</p>
                <p>Quantidade: {data.soma}</p>
                <p>Porcentagem: {percentage}%</p>
            </div>
        );
    }

    return null;
};

interface CustomPieLabelProps extends PieProps {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
    index: number;
    name: string;
    value: number;
}

const CustomPieLabel: React.FC<CustomPieLabelProps> = ({
    cx,
    cy,
    midAngle,
    innerRadius,
    outerRadius,
    percent,
    index,
    name,
    value,
}) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text
            x={x}
            y={y}
            fill={percent > 0.1 ? '#8884d8' : '#000'}
            textAnchor={x > cx ? 'start' : 'end'}
            dominantBaseline="central"
        >
            {name}
        </text>
    );
};

export default function Home() {
    const apiURL = 'http://localhost:5179/api/';
    const [data, setData] = useState<Ticket[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [chartDataType, setChartDataType] = useState<'categoria' | 'subcategoria'>('categoria');
    const chartOptions = [
        { value: 'categoria', label: 'Categoria' },
        { value: 'subcategoria', label: 'Subcategoria' },
    ];
    const [selectedCategoryDropdown, setSelectedCategoryDropdown] = useState<string | null>(null);
    const [chartType, setChartType] = useState<'pizza' | 'bar'>('pizza');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);

    const fetchData = async () => {
        try {
            const response = await fetch(`${apiURL}tickets`);
            if (!response.ok) {
                throw new Error('Erro ao buscar dados');
            }
            const fetchedData = await response.json();
            const parsedData = fetchedData.map((x: Omit<Ticket, 'data'> & { data: string }) => ({
                ...x,
                data: new Date(x.data),
            }));
            setData(parsedData);
            setError(null);
        } catch (err) {
            console.error("Erro ao buscar dados:", err);
            setError("Erro ao sincronizar dados. Tente novamente mais tarde.");
        }
    };

    useEffect(() => {
        fetchData().then(() => {
            const uniqueCategories = [...new Set(data.map(ticket => ticket.categoria))];
            setAvailableCategories(uniqueCategories);
        });
    }, [data]);

    const aggregatedData = data.reduce<Record<string, number>>((acumulador, ticket) => {
        let type: string;
        if (selectedCategoryDropdown) {
            if (ticket.categoria === selectedCategoryDropdown) {
                type = ticket.subcategoria;
            } else {
                return acumulador;
            }
        } else {
            type = ticket.categoria;
        }
        if (!acumulador[type]) {
            acumulador[type] = 0;
        }
        acumulador[type]++;
        return acumulador;
    }, {});

    const dataParaGrafico = Object.entries(aggregatedData).map(([type, soma]) => ({
        name: type,
        soma,
    }));

    const totalSoma = dataParaGrafico.reduce((sum, item) => sum + item.soma, 0);

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

    const handleChartDataTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        setChartDataType(event.target.value as 'categoria' | 'subcategoria');
    };

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
                    'mt-6 w-full max-w-md p-4 rounded-lg shadow scrollbar-container'
                )}>
                    <h2 className="text-lg font-semibold mb-3">Lista de Tickets</h2>
                    {data.length > 0 ? (
                        <ul
                            role="list"
                            className="divide-y divide-gray-300 dark:divide-gray-600 scrollbar-ul"
                            style={{ maxHeight: 'calc(7 * 56px)', overflowY: 'auto', paddingRight: '8px' }}
                        >
                            {data.map((item) => (
                                <li key={item.id} className="flex py-4 first:pt-0 last:pb-0">
                                    <div className="ml-3 overflow-hidden">
                                        <p className="text-sm font-medium">{item.subcategoria}</p>
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

                            <div className="mb-4">
                                <button
                                    onClick={() => setChartType('pizza')}
                                    className={clsx(
                                        'px-4 py-2 rounded-lg mr-2',
                                        chartType === 'pizza' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700 hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                    )}
                                >
                                    Pizza
                                </button>
                                <button
                                    onClick={() => setChartType('bar')}
                                    className={clsx(
                                        'px-4 py-2 rounded-lg',
                                        chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700 hover:bg-gray-400 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                    )}
                                >
                                    Barras
                                </button>
                            </div>

                            <div className="mb-4">
                                <label htmlFor="categoryDropdown" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Selecionar Categoria:</label>
                                <select
                                    id="categoryDropdown"
                                    className={clsx(
                                        'mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500',
                                        darkMode ? 'bg-gray-700 text-white border-gray-600 focus:ring-indigo-500 focus:border-indigo-500' : ''
                                    )}
                                    value={selectedCategoryDropdown || ''}
                                    onChange={(e) => setSelectedCategoryDropdown(e.target.value === '' ? null : e.target.value)}
                                >
                                    <option value="">Todas as Categorias</option>
                                    {availableCategories.map((category) => (
                                        <option key={category} value={category}>{category}</option>
                                    ))}
                                </select>
                            </div>

                            <ResponsiveContainer width="100%" height={300}>
                                {chartType === 'pizza' && (
                                    <PieChart>
                                        <Pie
                                            data={dataParaGrafico.filter(item => !selectedCategoryDropdown || item.name === selectedCategoryDropdown)}
                                            dataKey="soma"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            fill="#8884d8"
                                            label
                                        >
                                            { }
                                        </Pie>
                                        {selectedCategoryDropdown && ( //Subcategoria
                                            <Pie
                                                data={dataParaGrafico.filter(item => data.some(t => t.categoria === selectedCategoryDropdown && t.subcategoria === item.name))}
                                                dataKey="soma"
                                                nameKey="name"
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={50}
                                                outerRadius={80}
                                                fill="#8884d8"
                                            >
                                                { }
                                            </Pie>
                                        )}
                                        <Tooltip content={<CustomTooltip total={totalSoma} />} /> { }
                                    </PieChart>
                                )}

                                {chartType === 'bar' && (
                                    <BarChart data={dataParaGrafico.filter(item => !selectedCategoryDropdown || item.name === selectedCategoryDropdown || data.some(t => t.categoria === selectedCategoryDropdown && t.subcategoria === item.name))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="name" />
                                        <YAxis />
                                        <Tooltip />
                                        {/* <Legend /> */}
                                        <Bar dataKey="soma" fill="#8884d8" />
                                    </BarChart>
                                )}
                            </ResponsiveContainer>

                            {/* Labels customizados abaixo do gráfico */}
                            <div className="flex flex-wrap justify-center mt-4">
                                {dataParaGrafico.filter(item => !selectedCategoryDropdown || item.name === selectedCategoryDropdown || data.some(t => t.categoria === selectedCategoryDropdown && t.subcategoria === item.name)).map(item => (
                                    <div key={item.name} className="flex items-center mr-4 mb-2">
                                        <div
                                            className="w-4 h-4 rounded-full mr-2"
                                            style={{ backgroundColor: '#8884d8' }}
                                        ></div>
                                        <span>
                                            {chartType === 'pizza'
                                                ? `${((item.soma / totalSoma) * 100).toFixed(2)}% ${item.name}`
                                                : item.name}
                                        </span>
                                    </div>
                                ))}
                            </div>

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