import fs from 'fs';
import path from 'path';
import axios from 'axios';
import readline from 'readline';
import {configDotenv} from "dotenv";

configDotenv()

if (!process.env.DEEPSEEK_API_KEY) {
    console.error("API_KEY未加载，无法继续", process.env.DEEPSEEK_API_KEY);
    process.exit(1);
}

const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = String(process.env.DEEPSEEK_API_URL);
const SOURCE_DIR = path.resolve(__dirname, './locales/source');
const TARGET_DIR = path.resolve(__dirname, './locales/target');

// 确保输出目录存在
if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
}

// 命令行读取接口
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// 翻译文件内容的函数
async function translateContent(content: string, targetLanguage: string): Promise<string> {
    const response = await axios.post(
        API_URL,
        {
            model: 'deepseek-chat',
            messages: [
                {
                    role: 'user',
                    content: `将以下内容翻译为${targetLanguage}，不要修改代码变量名、函数名和结构，仅翻译注释和字符串。翻译结果中严禁增加任何额外的注释或内容，严禁使用Markdown代码标记符号（例如：\`\`\`）：\n\n${content}`,
                },
            ],
            stream: false,
        },
        {
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
        }
    );

    return response.data.choices[0].message.content.replace(/```[a-z]*\n?|```/g, '').trim();
}

// 处理目录内所有文件
async function translateDirectory(srcDir: string, tgtDir: string, targetLanguage: string) {
    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        const filePath = path.join(srcDir, file);
        const ext = path.extname(file);

        // 如果是目录，跳过处理
        if (fs.statSync(filePath).isDirectory()) continue;

        // 如果是文件且符合条件，进行翻译
        if (['.js', '.ts', '.json'].includes(ext)) {
            const content = fs.readFileSync(filePath, 'utf8');
            console.log(`正在翻译文件: ${file}`);
            try {
                const translatedContent = await translateContent(content, targetLanguage);
                fs.writeFileSync(path.join(tgtDir, file), translatedContent);
                console.log(`翻译完成并已保存: ${file}`);
            } catch (error) {
                console.error(`翻译失败: ${file}`, error);
            }
        }
    }
}

// 语言选择和确认
function askQuestion(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    const targetLanguage = await askQuestion('请输入要翻译的目标语言（如：中文、法语等）：');
    await translateDirectory(SOURCE_DIR, TARGET_DIR, targetLanguage);
    rl.close();
}

main();
