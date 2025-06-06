/*const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { google } = require('googleapis');
const base64Img = require('base64-img');
const fs = require('fs');
const path = require('path');
const formidable = require('formidable');*/

import express from 'express'
import pg from 'pg'
import cors from 'cors'
import { google } from 'googleapis'
import base64Img from 'base64-img'
import fs from 'fs'
import path from 'path'
import formidable from 'formidable';
import { fileURLToPath } from 'url';

const { Pool } = pg
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

const __filename = fileURLToPath(import.meta.url); 
const __dirname = path.dirname(__filename);

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
    const form = formidable({ multiples: true });
    form.parse(req, async (err, fields, files) => {
        // Variável para armazenar o caminho temporário da imagem, para garantir a remoção em caso de erro
        let tempImagePath = null;

    try {
        const imageData = Array.isArray(fields.imageData) ? fields.imageData[0] : fields.imageData;
        const title = Array.isArray(fields.title) ? fields.title[0] : fields.title;
        const description = Array.isArray(fields.description) ? fields.description[0] : fields.description;
        const startDate = Array.isArray(fields.startDate) ? fields.startDate[0] : fields.startDate;
        const endDate = Array.isArray(fields.endDate) ? fields.endDate[0] : fields.endDate;
        const category = Array.isArray(fields.category) ? fields.category[0] : fields.category;
        const chartType = Array.isArray(fields.chartType) ? fields.chartType[0] : fields.chartType;

        console.log("Dados recebidos no backend (após tratamento):", {
            imageData: imageData ? 'recebido' : 'vazio',
            title, // Agora 'title' deve ser uma string simples
            description,
            startDate,
            endDate,
            category,
            chartType
        });
        console.log(imageData)
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

            await addAllowedUser(drive, presentationId,'arturblancop@gmail.com', 'writer');

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

        // Torna a imagem acessível publicamente (leitura) no Google Drive
        await drive.permissions.create({
            fileId: imageFileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // ... dentro da sua rota /api/export-to-google-slides ...

        // Dimensões padrão do slide 16:9 em EMU
        const SLIDE_WIDTH_EMU = 9144000;
        const SLIDE_HEIGHT_EMU = 5143500;
        // 1 pixel = 12700 EMUs
        const PX_TO_EMU = 12700;

        // ajustar dimensões da imagem
        const IMAGE_CAPTURE_WIDTH_PX = 1200; // Ou o valor real da sua captura
        const IMAGE_CAPTURE_HEIGHT_PX = 675; // Ou o valor real da sua captura

        // calcula as dimensões da imagem para caber no slide com uma margem
        const targetImageWidthEmu = IMAGE_CAPTURE_WIDTH_PX * PX_TO_EMU * 0.75;
        const targetImageHeightEmu = IMAGE_CAPTURE_HEIGHT_PX * PX_TO_EMU * 0.75;

        // calcula a posição para centralizar a imagem
        const imageTranslateX = (SLIDE_WIDTH_EMU - targetImageWidthEmu) / 2;
        const imageTranslateY = (SLIDE_HEIGHT_EMU - targetImageHeightEmu) / 2;

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
                    url: imageUrl,
                    elementProperties: {
                        pageObjectId: 'newSlide',
                        size: {
                            width: { magnitude: targetImageWidthEmu * 0.8, unit: 'EMU' },
                            height: { magnitude: targetImageHeightEmu * 0.8, unit: 'EMU' },
                        },
                        
                    },
                },
            },
            {
                // cria caixa de texto para o Título
                createShape: {
                    objectId: 'titleTextBox',
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: 'newSlide',
                        size: {
                            width: { magnitude: SLIDE_WIDTH_EMU * 0.8, unit: 'EMU' },
                            height: { magnitude: 500000, unit: 'EMU' },
                        },
                    },
                },
            },
            {
                // insere o texto do título
                insertText: {
                    objectId: 'titleTextBox',
                    insertionIndex: 0,
                    text: `Relatório de Tickets: ${title || 'Gráfico/Dados'}`,
                },
            },
            {
                // cria caixa de texto para a Descrição/Metadados
                createShape: {
                    objectId: 'descriptionTextBox',
                    shapeType: 'TEXT_BOX',
                    elementProperties: {
                        pageObjectId: 'newSlide',
                        size: {
                            width: { magnitude: SLIDE_WIDTH_EMU * 0.8, unit: 'EMU' },
                            height: { magnitude: 500000, unit: 'EMU' },
                        },
                    },
                },
            },
            {
                // insere o texto da descrição/metadados
                insertText: {
                    objectId: 'descriptionTextBox',
                    insertionIndex: 0,
                    text: `Período: ${startDate || 'Início'} a ${endDate || 'Fim'}\nCategoria: ${category || 'Todas'}\nGerado em: ${new Date().toLocaleDateString('pt-BR')}`,
                },
            },
            {
                // exclui o slide padrão inicial para ter apenas o seu slide personalizado
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

        // exclui a imagem temporária do servidor após o upload
        fs.unlinkSync(tempImagePath);

        res.status(200).json({
            message: 'Apresentação criada com sucesso!',
            presentationId: presentationId,
            presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
        });

    } catch (error) {
        console.error('Erro ao exportar para Google Slides:', error);
        // garante que o arquivo temporário seja removido mesmo em caso de erro
        if (tempImagePath && fs.existsSync(tempImagePath)) {
            fs.unlinkSync(tempImagePath);
        }
        res.status(500).json({ message: 'Erro interno do servidor ao exportar.', error: error.message });
    }
    });

});

// Assuming you have your Google Drive API client initialized as 'drive'
// For example: const drive = google.drive({ version: 'v3', auth: authClient });

async function addAllowedUser(drive,presentationId, userEmail, role) {
    try {
        const permission = await drive.permissions.create({
            fileId: presentationId,
            requestBody: {
                type: 'user', // Can be 'user', 'group', 'domain', or 'anyone'
                role: role,   // Can be 'reader', 'writer', 'commenter', 'owner'
                emailAddress: userEmail,
            },
            // Optional: sendNotificationEmail to notify the user
            sendNotificationEmail: true,
            // Optional: emailMessage for the notification email
            emailMessage: `You've been granted <span class="math-inline">\{role\} access to the presentation "</span>{newPresentation.data.title}".`,
        });
        console.log(`Permission added for ${userEmail} with role: ${role}`);
        return permission.data;
    } catch (error) {
        console.error('Error adding permission:', error);
        throw error;
    }
}

// --- Inicialização do Servidor ---
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Acesse http://localhost:${port}`);
});