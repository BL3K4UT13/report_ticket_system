const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { google } = require('googleapis');
const base64Img = require('base64-img');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 5179;

app.use(express.json({ limit: '10mb' }));
app.use(cors({
    origin: '*',
    credentials: true,
}));

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'Blekaut13!',
    port: 5000,
});

// --- Configuração da Google API ---
// Lembre-se: Para produção, é ALTAMENTE RECOMENDADO USAR VARIÁVEIS DE AMBIENTE para credenciais sensíveis.
// Por favor, garanta que 'service-account-key.json' esteja no mesmo diretório que 'server.js'.
const KEYFILEPATH = path.join(__dirname, 'service-account-key.json');

const SCOPES = [
    'https://www.googleapis.com/auth/presentations',
    'https://www.googleapis.com/auth/drive',
];

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
    scopes: SCOPES,
});

// --- Rotas da API existentes ---
app.get('/api/tickets', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM tickets');
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar tickets:', err);
        res.status(500).json({ error: 'Erro ao buscar tickets' });
    }
});

app.post('/api/export-to-google-slides', async (req, res) => {
    // Variável para armazenar o caminho temporário da imagem, para garantir a remoção em caso de erro
    let tempImagePath = null;

    try {
        const { imageData, title, description, startDate, endDate, category, chartType } = req.body;

        if (!imageData) {
            return res.status(400).json({ message: 'Dados da imagem são necessários.' });
        }

        const slides = google.slides({ version: 'v1', auth });
        const drive = google.drive({ version: 'v3', auth });

        // Decodificar a imagem Base64 e salvar temporariamente
        tempImagePath = base64Img.imgSync(imageData, path.join(__dirname, 'temp'), `chart_export_${Date.now()}`);

        const newPresentation = await slides.presentations.create({
            requestBody: {
                title: title || `Relatório de Tickets - ${new Date().toLocaleDateString('pt-BR')}`,
            },
        });
        const presentationId = newPresentation.data.presentationId;

        // upload da imagem para o Google Drive
        const imageFile = await drive.files.create({
            requestBody: {
                name: `grafico-${Date.now()}.png`,
                mimeType: 'image/png',
            },
            media: {
                mimeType: 'image/png',
                body: fs.createReadStream(tempImagePath),
            },
            // Adicionar webContentLink para obter o URL direto de download
            fields: 'id, webViewLink, webContentLink',
        });
        const imageFileId = imageFile.data.id;
        const imageUrl = imageFile.data.webContentLink; // Este é o URL que a API de Slides precisa

        // 4. Tornar a imagem acessível publicamente (leitura) no Google Drive
        // ESSENCIAL para que a imagem seja exibida na apresentação do Slides
        await drive.permissions.create({
            fileId: imageFileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // Dimensões padrão do slide 16:9 em EMU
        const SLIDE_WIDTH_EMU = 9144000;
        const SLIDE_HEIGHT_EMU = 5143500;
        // Aproximadamente 1 pixel = 12700 EMUs para o cálculo
        const PX_TO_EMU = 12700;

        // Você pode ajustar as dimensões da imagem aqui com base na sua captura no frontend
        // Exemplo: se o html2canvas gera uma imagem de 1200x675px (proporção 16:9)
        const IMAGE_CAPTURE_WIDTH_PX = 1200;
        const IMAGE_CAPTURE_HEIGHT_PX = 675;

        // Calcula as dimensões da imagem para caber no slide com uma margem
        const targetImageWidthEmu = IMAGE_CAPTURE_WIDTH_PX * PX_TO_EMU * 0.75; // Usa 75% da largura da captura
        const targetImageHeightEmu = IMAGE_CAPTURE_HEIGHT_PX * PX_TO_EMU * 0.75; // E 75% da altura

        // Calcula a posição para centralizar a imagem
        const imageTranslateX = (SLIDE_WIDTH_EMU - targetImageWidthEmu) / 2;
        const imageTranslateY = (SLIDE_HEIGHT_EMU - targetImageHeightEmu) / 2;

        // 5. Adicionar um novo slide à apresentação e inserir a imagem e texto
        const requests = [
            {
                createSlide: {
                    objectId: 'newSlide',
                    insertionIndex: 1,
                    slideLayoutReference: {
                        predefinedLayout: 'BLANK',
                    },
                },
            },
            {
                createImage: {
                    objectId: 'exportedImage',
                    url: imageUrl, // Agora usando o webContentLink da imagem do Drive
                    elementProperties: {
                        pageObjectId: 'newSlide',
                        size: {
                            width: { magnitude: targetImageWidthEmu, unit: 'EMU' },
                            height: { magnitude: targetImageHeightEmu, unit: 'EMU' },
                        },
                        transform: {
                            translateX: { magnitude: imageTranslateX, unit: 'EMU' },
                            translateY: { magnitude: imageTranslateY, unit: 'EMU' },
                        },
                    },
                },
            },
            {
                // Cria caixa de texto para o Título (ajustado para ser mais acima)
                createShape: {
                    objectId: 'titleTextBox',
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: 'newSlide',
                        size: {
                            width: { magnitude: SLIDE_WIDTH_EMU * 0.9, unit: 'EMU' },
                            height: { magnitude: 500000, unit: 'EMU' },
                        },
                        transform: {
                            translateX: { magnitude: SLIDE_WIDTH_EMU * 0.05, unit: 'EMU' }, // 5% de margem esquerda
                            translateY: { magnitude: SLIDE_HEIGHT_EMU * 0.05, unit: 'EMU' }, // 5% do topo
                        },
                    },
                },
            },
            {
                // Insere o texto do título
                insertText: {
                    objectId: 'titleTextBox',
                    insertionIndex: 0,
                    text: `Relatório de Tickets: ${title || 'Gráfico/Dados'}`,
                },
            },
            {
                // Cria caixa de texto para a Descrição/Metadados (ajustado para o rodapé)
                createShape: {
                    objectId: 'descriptionTextBox',
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: 'newSlide',
                        size: {
                            width: { magnitude: SLIDE_WIDTH_EMU * 0.9, unit: 'EMU' },
                            height: { magnitude: 500000, unit: 'EMU' },
                        },
                        transform: {
                            translateX: { magnitude: SLIDE_WIDTH_EMU * 0.05, unit: 'EMU' },
                            translateY: { magnitude: SLIDE_HEIGHT_EMU * 0.9, unit: 'EMU' }, // Posiciona próximo ao rodapé
                        },
                    },
                },
            },
            {
                // Insere o texto da descrição/metadados
                insertText: {
                    objectId: 'descriptionTextBox',
                    insertionIndex: 0,
                    text: `Período: ${startDate || 'Início'} a ${endDate || 'Fim'}\nCategoria: ${category || 'Todas'}\nGerado em: ${new Date().toLocaleDateString('pt-BR')}`,
                },
            },
            {
                // Opcional: Exclui o slide padrão inicial para ter apenas o seu slide personalizado
                deleteObject: {
                    objectId: newPresentation.data.slides[0].objectId
                }
            }
        ];

        await slides.presentations.batchUpdate({
            presentationId: presentationId,
            requestBody: {
                requests: requests,
            },
        });

        // 6. Excluir a imagem temporária do servidor após o upload
        fs.unlinkSync(tempImagePath);

        res.status(200).json({
            message: 'Apresentação criada com sucesso!',
            presentationId: presentationId,
            presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
        });

    } catch (error) {
        console.error('Erro ao exportar para Google Slides:', error);
        // Garante que o arquivo temporário seja removido mesmo em caso de erro
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }
        res.status(500).json({ message: 'Erro interno do servidor ao exportar.', error: error.message });
    }
});

// --- Inicialização do Servidor ---
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Acesse http://localhost:${port}`);
});