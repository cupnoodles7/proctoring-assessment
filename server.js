const express = require('express');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const activeExams = new Map();

function generateExamId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/api/generate-questions', (req, res) => {
    const { topic, questionType, difficulty, numQuestions } = req.body;
    if (!topic || !questionType || !difficulty || !numQuestions) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const pythonProcess = spawn('python', [
        'question_generator.py',
        topic,
        questionType,
        difficulty,
        numQuestions
    ]);

    let questionData = '';
    pythonProcess.stdout.on('data', (data) => {
        questionData += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
        console.error(`Python Error: ${data}`);
    });

    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            return res.status(500).json({ error: 'Question generation failed' });
        }

        try {
            const questions = JSON.parse(questionData);
            const examId = generateExamId();
            activeExams.set(examId, {
                questions,
                createdAt: new Date(),
                userResponses: [],
                proctorEvents: []
            });
            res.json({ examId, questionCount: questions.length });
        } catch (error) {
            res.status(500).json({ error: 'Failed to parse question data' });
        }
    });
});

app.get('/exam/:examId', (req, res) => {
    const { examId } = req.params;
    if (!activeExams.has(examId)) {
        return res.status(404).send('Exam not found');
    }
    res.sendFile(path.join(__dirname, 'public', 'exam.html'));
});

app.get('/api/exam/:examId/questions', (req, res) => {
    const { examId } = req.params;
    if (!activeExams.has(examId)) {
        return res.status(404).json({ error: 'Exam not found' });
    }
    res.json({ questions: activeExams.get(examId).questions });
});

app.post('/api/exam/:examId/proctor-event', (req, res) => {
    const { examId } = req.params;
    const { eventType, details } = req.body;
    if (!activeExams.has(examId)) {
        return res.status(404).json({ error: 'Exam not found' });
    }
    activeExams.get(examId).proctorEvents.push({
        timestamp: new Date(),
        eventType,
        details
    });
    res.json({ status: 'Event logged' });
});

app.post('/api/exam/:examId/submit', (req, res) => {
    const { examId } = req.params;
    const { answers } = req.body;
    if (!activeExams.has(examId)) {
        return res.status(404).json({ error: 'Exam not found' });
    }

    const examData = activeExams.get(examId);
    examData.userResponses = answers;
    examData.completedAt = new Date();

    res.json({
        status: 'Exam submitted',
        proctorEvents: examData.proctorEvents.length,
        timestamp: examData.completedAt
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
