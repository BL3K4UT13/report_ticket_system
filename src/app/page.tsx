'use client';

import { useState, useEffect, useRef } from 'react';
import {
    PieChart,
    Pie,
    ResponsiveContainer,
    Tooltip,
    PieProps,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Cell,
} from 'recharts';
import { Moon, Sun, Ticket, Copy } from 'lucide-react';
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
    if (active && payload && payload.length > 0 && typeof total === 'number') {
        const data = payload[0].payload;
        const value = payload[0].value;
        const percentage = ((value / total) * 100).toFixed(2);

        return (
            <div className="bg-white p-2 rounded shadow-md text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                <p className="font-semibold">{data.name}</p>
                <p>Quantidade: {value}</p>
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

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#a4add3', '#d18975', '#6a5acd', '#40e0d0', '#ffa07a', '#98fb98'];

export default function Home() {
    const apiURL = 'http://localhost:5179/api/';
    const [data, setData] = useState<Ticket[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // NOVO: Estado para o modal de exportação
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [chartDataType, setChartDataType] = useState<'categoria' | 'subcategoria'>('categoria');
    const [selectedCategoryDropdown, setSelectedCategoryDropdown] = useState<string | null>(null);
    const [chartType, setChartType] = useState<'pizza' | 'bar' | 'raw'>('pizza');
    const [availableCategories, setAvailableCategories] = useState<string[]>([]);
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const rawDataRef = useRef<HTMLDivElement>(null);
    const [copyFeedback, setCopyFeedback] = useState('');
    // NOVO: Estado para a seleção do tipo de gráfico a exportar
    const [chartTypeToExport, setChartTypeToExport] = useState<'pizza' | 'bar' | 'raw' | 'all'>('all'); // 'all' para exportar tudo

    useEffect(() => {
        const fetchInitialData = async () => {
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
        fetchInitialData();
    }, []);

    useEffect(() => {
        const uniqueCategories = [...new Set(data.map(ticket => ticket.categoria))];
        setAvailableCategories(uniqueCategories);
    }, [data]);

    const filteredData = data.filter(ticket => {
        const ticketDate = ticket.data.getTime();
        const start = startDate ? new Date(startDate).getTime() : null;
        const end = endDate ? new Date(endDate).getTime() : null;

        if (start && ticketDate < start) return false;
        if (end && ticketDate > end) return false;
        return true;
    });

    const aggregatedByCategory = filteredData.reduce<Record<string, number>>((acc, ticket) => {
        acc[ticket.categoria] = (acc[ticket.categoria] || 0) + 1;
        return acc;
    }, {});

    const aggregatedBySubcategory: Record<string, Record<string, number>> = {};
    filteredData.forEach(ticket => {
        if (!aggregatedBySubcategory[ticket.categoria]) {
            aggregatedBySubcategory[ticket.categoria] = {};
        }
        aggregatedBySubcategory[ticket.categoria][ticket.subcategoria] =
            (aggregatedBySubcategory[ticket.categoria][ticket.subcategoria] || 0) + 1;
    });

    const dataParaGrafico = selectedCategoryDropdown
        ? Object.entries(aggregatedBySubcategory[selectedCategoryDropdown] || {}).map(([sub, soma]) => ({
              name: sub,
              soma,
          }))
        : Object.entries(aggregatedByCategory).map(([cat, soma]) => ({
              name: cat,
              soma,
          }));

    const totalSoma = dataParaGrafico.reduce((sum, item) => sum + item.soma, 0);

    const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' });

    const handleCopyRawData = () => {
        if (rawDataRef.current) {
            let textToCopy = "Dados Brutos:\n";
            Object.entries(aggregatedBySubcategory).forEach(([category, subcategories]) => {
                if (selectedCategoryDropdown && category !== selectedCategoryDropdown) {
                    return;
                }
                const totalCategoryCount = Object.values(subcategories).reduce((sum, count) => sum + count, 0);
                textToCopy += `${category}: ${totalCategoryCount}\n`;
                Object.entries(subcategories).forEach(([sub, count]) => {
                    const percentage = totalCategoryCount > 0 ? ((count / totalCategoryCount) * 100).toFixed(2) : '0.00';
                    textToCopy += `  - ${sub}: ${count} (${percentage}%)\n`;
                });
            });

            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    setCopyFeedback('Copiado!');
                    setTimeout(() => setCopyFeedback(''), 2000);
                })
                .catch(err => {
                    setCopyFeedback('Erro ao copiar.');
                    console.error('Erro ao copiar texto: ', err);
                });
        }
    };

    // MODIFICADO: handleExport agora abre o modal de exportação
    const handleExport = () => {
        setIsExportModalOpen(true);
    };

    // NOVA FUNÇÃO: handleConfirmExport para gerar o arquivo
    const handleConfirmExport = () => {
        let exportData = "Relatório de Tickets\n";
        exportData += "Data de Geração: " + new Date().toLocaleDateString('pt-BR') + "\n";
        exportData += "Período: " + (startDate || 'Início') + " a " + (endDate || 'Fim') + "\n";
        exportData += "Categoria Filtrada: " + (selectedCategoryDropdown || 'Todas as Categorias') + "\n\n";

        if (chartTypeToExport === 'all' || chartTypeToExport === 'raw') {
            exportData += "--- Dados Brutos ---\n";
            if (Object.keys(aggregatedBySubcategory).length > 0) {
                Object.entries(aggregatedBySubcategory).forEach(([category, subcategories]) => {
                    if (selectedCategoryDropdown && category !== selectedCategoryDropdown) {
                        return;
                    }
                    const totalCategoryCount = Object.values(subcategories).reduce((sum, count) => sum + count, 0);
                    exportData += `${category}: ${totalCategoryCount}\n`;
                    Object.entries(subcategories).forEach(([sub, count]) => {
                        const percentage = totalCategoryCount > 0 ? ((count / totalCategoryCount) * 100).toFixed(2) : '0.00';
                        exportData += `  - ${sub}: ${count} (${percentage}%)\n`;
                    });
                });
            } else {
                exportData += "Nenhum dado bruto disponível para os filtros selecionados.\n";
            }
            exportData += "\n";
        }

        if (chartTypeToExport === 'all' || chartTypeToExport === 'pizza' || chartTypeToExport === 'bar') {
            exportData += "--- Dados Agregados para Gráfico ---\n";
            if (dataParaGrafico.length > 0) {
                dataParaGrafico.forEach(item => {
                    const percentage = totalSoma > 0 ? ((item.soma / totalSoma) * 100).toFixed(2) : '0.00';
                    exportData += `${item.name}: ${item.soma} (${percentage}%)\n`;
                });
            } else {
                exportData += "Nenhum dado agregado disponível para os filtros selecionados.\n";
            }
            exportData += "\n";
        }


        const blob = new Blob([exportData], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_tickets_${chartTypeToExport}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setIsExportModalOpen(false); // Fecha o modal de exportação após concluir
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
                    <button onClick={() => fetchData()} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
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
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-20"> {/* Aumentei o z-index */}
                        <div className={clsx(
                            darkMode ? 'dark bg-gray-800 text-white' : 'bg-white text-gray-900',
                            'p-6 rounded-lg shadow-lg max-w-4xl w-full'
                        )}>
                            <h2 className="text-xl font-bold mb-4">Gráfico de Tickets</h2>

                            <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setChartType('pizza')}
                                        className={clsx(
                                            'px-4 py-2 rounded-lg',
                                            chartType === 'pizza' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700 hover:bg-gray-400',
                                            darkMode && chartType !== 'pizza' && 'dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                        )}
                                    >
                                        Pizza
                                    </button>
                                    <button
                                        onClick={() => setChartType('bar')}
                                        className={clsx(
                                            'px-4 py-2 rounded-lg',
                                            chartType === 'bar' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700 hover:bg-gray-400',
                                            darkMode && chartType !== 'bar' && 'dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                        )}
                                    >
                                        Barras
                                    </button>
                                    <button
                                        onClick={() => setChartType('raw')}
                                        className={clsx(
                                            'px-4 py-2 rounded-lg',
                                            chartType === 'raw' ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-700 hover:bg-gray-400',
                                            darkMode && chartType !== 'raw' && 'dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                                        )}
                                    >
                                        Dados Brutos
                                    </button>
                                </div>

                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                                    <div className="flex flex-col">
                                        <label htmlFor="startDate" className="text-sm mb-1">Data Inicial:</label>
                                        <input
                                            type="date"
                                            id="startDate"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className={clsx(
                                                "rounded p-1 text-black border",
                                                darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"
                                            )}
                                        />
                                    </div>
                                    <div className="flex flex-col">
                                        <label htmlFor="endDate" className="text-sm mb-1">Data Final:</label>
                                        <input
                                            type="date"
                                            id="endDate"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className={clsx(
                                                "rounded p-1 text-black border",
                                                darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-white border-gray-300"
                                            )}
                                        />
                                    </div>
                                </div>
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

                            <div className="flex flex-col md:flex-row gap-4 items-center md:items-start">
                                {chartType !== 'raw' && (
                                    <ResponsiveContainer width="100%" height={300} className="flex-grow">
                                        {chartType === 'pizza' && (
                                            <PieChart>
                                                <Pie
                                                    data={dataParaGrafico}
                                                    dataKey="soma"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {
                                                        dataParaGrafico.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                        ))
                                                    }
                                                </Pie>
                                                <Tooltip content={<CustomTooltip total={totalSoma} />} />
                                            </PieChart>
                                        )}

                                        {chartType === 'bar' && (
                                            <BarChart
                                                data={dataParaGrafico}
                                            >
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="name" />
                                                <YAxis />
                                                <Tooltip content={<CustomTooltip total={totalSoma} />} />
                                                <Bar dataKey="soma">
                                                    {dataParaGrafico.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        )}
                                    </ResponsiveContainer>
                                )}

                                {chartType === 'raw' && (
                                    <div
                                        ref={rawDataRef}
                                        className={clsx(
                                            "flex-grow w-full h-[400px] p-4 border rounded-lg overflow-y-auto relative",
                                            darkMode ? "bg-gray-700 text-white border-gray-600" : "bg-gray-50 text-gray-800 border-gray-200"
                                        )}
                                    >
                                        <div className="flex justify-between items-center mb-2 sticky top-0 bg-inherit z-10">
                                            <h3 className="font-bold">Dados Brutos (Filtrados por Data e Categoria)</h3>
                                            <button
                                                onClick={handleCopyRawData}
                                                className="flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 text-sm"
                                            >
                                                <Copy className="w-4 h-4" />
                                                {copyFeedback || 'Copiar'}
                                            </button>
                                        </div>
                                        {Object.keys(aggregatedBySubcategory).length > 0 ? (
                                            <ul className="list-disc pl-5">
                                                {Object.entries(aggregatedBySubcategory).map(([category, subcategories]) => {
                                                    if (selectedCategoryDropdown && category !== selectedCategoryDropdown) {
                                                        return null;
                                                    }

                                                    const totalCategoryCount = Object.values(subcategories).reduce((sum, count) => sum + count, 0);

                                                    return (
                                                        <li key={category} className="mb-2">
                                                            <span className="font-semibold">{category}: {totalCategoryCount}</span>
                                                            <ul className="list-circle pl-6 mt-1">
                                                                {Object.entries(subcategories).map(([sub, count]) => {
                                                                    const percentage = totalCategoryCount > 0 ? ((count / totalCategoryCount) * 100).toFixed(2) : '0.00';
                                                                    return (
                                                                        <li key={sub}>
                                                                            {sub}: {count} ({percentage}%)
                                                                        </li>
                                                                    );
                                                                })}
                                                            </ul>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        ) : (
                                            <p className="text-gray-500 dark:text-gray-400">Nenhum dado bruto disponível para os filtros selecionados.</p>
                                        )}
                                    </div>
                                )}

                                {chartType !== 'raw' && (
                                    <div className="flex flex-wrap md:flex-col justify-center md:justify-start mt-4 md:mt-0 md:ml-4 flex-shrink-0 max-h-[300px] overflow-y-auto">
                                        {dataParaGrafico.map((item, index) => (
                                            <div key={item.name} className="flex items-center mr-4 mb-2 md:mr-0">
                                                <div
                                                    className="w-4 h-4 rounded-full mr-2"
                                                    style={{ backgroundColor: COLORS[index % COLORS.length]} }
                                                ></div>
                                                <span>
                                                    {`${((item.soma / totalSoma) * 100).toFixed(2)}% ${item.name}`}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-end mt-4 gap-2">
                                <button
                                    onClick={handleExport} // Agora abre o modal de exportação
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-600"
                                >
                                    Exportar
                                </button>
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 dark:bg-red-700 dark:hover:bg-red-600"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* NOVO MODAL: Modal de Configuração de Exportação */}
                {isExportModalOpen && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-30"> {/* Z-index maior para ficar por cima do modal principal */}
                        <div className={clsx(
                            darkMode ? 'dark bg-gray-800 text-white' : 'bg-white text-gray-900',
                            'p-6 rounded-lg shadow-lg max-w-sm w-full'
                        )}>
                            <h3 className="text-lg font-bold mb-4">Configurar Exportação</h3>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Qual conteúdo você deseja exportar?
                                </label>
                                <div className="flex flex-col space-y-2">
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-blue-600 dark:text-blue-400"
                                            name="exportOption"
                                            value="all"
                                            checked={chartTypeToExport === 'all'}
                                            onChange={() => setChartTypeToExport('all')}
                                        />
                                        <span className="ml-2">Todos os dados (Gráficos e Brutos)</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-blue-600 dark:text-blue-400"
                                            name="exportOption"
                                            value="pizza"
                                            checked={chartTypeToExport === 'pizza'}
                                            onChange={() => setChartTypeToExport('pizza')}
                                        />
                                        <span className="ml-2">Apenas dados de Gráfico (Pizza/Barras)</span>
                                    </label>
                                    <label className="inline-flex items-center">
                                        <input
                                            type="radio"
                                            className="form-radio text-blue-600 dark:text-blue-400"
                                            name="exportOption"
                                            value="raw"
                                            checked={chartTypeToExport === 'raw'}
                                            onChange={() => setChartTypeToExport('raw')}
                                        />
                                        <span className="ml-2">Apenas dados Brutos</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setIsExportModalOpen(false)} // Fecha o modal de exportação
                                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleConfirmExport} // Confirma e inicia a exportação
                                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                                >
                                    Concluir
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}