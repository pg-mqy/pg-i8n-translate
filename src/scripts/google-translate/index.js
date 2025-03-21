const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer').default;
const tunnel = require('tunnel');
const googleTranslate = require('@vitalets/google-translate-api');
const {parseDocument, DomUtils} = require('htmlparser2');

// **代理服务器配置**
const agent = tunnel.httpsOverHttp({
    proxy: {
        host: '127.0.0.1',
        port: 7890,
        headers: {'User-Agent': 'Node'}
    }
});

//  **默认语言**
const SOURCE_LANG = 'en';
let TARGET_LANG = 'zh-CN';

// **语言选项**
const LANGUAGE_OPTIONS = [
    {name: '🇨🇳 中文（简体）', value: 'zh-CN'},
    {name: '🇨🇳 中文（繁体）', value: 'zh-TW'},
    {name: '🇺🇸 英语', value: 'en'},
    {name: '🇫🇷 法语', value: 'fr'},
    {name: '🇪🇸 西班牙语', value: 'es'},
    {name: '🇩🇪 德语', value: 'de'},
    {name: '🇯🇵 日语', value: 'ja'},
    {name: '🇰🇷 韩语', value: 'ko'},
    {name: '🇷🇺 俄语', value: 'ru'},
    {name: '🇮🇹 意大利语', value: 'it'},
    {name: '🇵🇹 葡萄牙语', value: 'pt'}
];

/**
 * **Google 翻译 API**
 */
const googleTranslator = async (text, retries = 3) => {
    try {
        const response = await googleTranslate(text, {from: SOURCE_LANG, to: TARGET_LANG}, {agent});

        if (!response || !response.text) {
            throw new Error('Google API 返回空数据');
        }
        return response.text;
    } catch (err) {
        console.error(`翻译失败: ${err.message}`);

        if (retries > 0) {
            console.log(`等待 1 秒后重试... 剩余尝试次数: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            return googleTranslator(text, retries - 1);
        }

        return text;
    }
};

/**
 * **批量翻译 title 字段**
 */
const batchTranslate = async (fields) => {
    console.log(`开始批量翻译 ${fields.length} 个字段`);
    let result = {};

    for (const {key, value} of fields) {
        try {
            const translated = await googleTranslator(value);
            result[key] = translated;
            console.log(`翻译 "${value}" => "${translated}"`);
        } catch (err) {
            console.error(`翻译失败: ${err.message}`);
            result[key] = value;
        }
    }

    return result;
};

/**
 * **解析 HTML 并翻译**
 */
const safeTranslate = async (html) => {
    await new Promise(resolve => setTimeout(resolve, 500)); // 限制请求频率

    try {
        const dom = parseDocument(html);
        const textNodes = [];

        const extractText = (nodes) => {
            nodes.forEach(node => {
                if (node.type === 'text' && node.data.trim()) {
                    console.log(`发现文本: "${node.data}"`);
                    textNodes.push(node);
                } else if (node.children) {
                    extractText(node.children);
                }
            });
        };

        extractText(dom.children);
        console.log(`共发现 ${textNodes.length} 段可翻译文本`);

        for (const node of textNodes) {
            console.log(`翻译: "${node.data}" ...`);
            node.data = await googleTranslator(node.data);
            console.log(`翻译完成: "${node.data}"`);
        }

        return DomUtils.getOuterHTML(dom);
    } catch (err) {
        console.error(`翻译 HTML 失败: ${err.message}`);
        return html;
    }
};

/**
 * **翻译 JSON 数据**
 */
const translateRun = async (inputJson) => {
    const flat = flattenObject(inputJson);
    const normalFields = [];
    const richFields = [];

    for (const key in flat) {
        const lastKey = key.split('.').pop();
        if (['title', 'content'].includes(lastKey)) {
            if (lastKey === 'content') {
                richFields.push({key, value: flat[key]});
            } else {
                normalFields.push({key, value: flat[key]});
            }
        }
    }

    const normalTranslations = await batchTranslate(normalFields);
    const richTranslations = {};
    for (const {key, value} of richFields) {
        richTranslations[key] = await safeTranslate(value);
    }

    return unFlattenObject({...flat, ...normalTranslations, ...richTranslations});
};

/**
 * **扁平化 JSON**
 */
function flattenObject(obj, prefix = '') {
    let result = {};
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            const nestedKey = prefix ? `${prefix}.${index}` : `${index}`;
            if (typeof item === 'object' && item !== null) {
                Object.assign(result, flattenObject(item, nestedKey));
            } else {
                result[nestedKey] = item;
            }
        });
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const nestedKey = prefix ? `${prefix}.${key}` : key;
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    Object.assign(result, flattenObject(obj[key], nestedKey));
                } else {
                    result[nestedKey] = obj[key];
                }
            }
        }
    } else {
        result[prefix] = obj;
    }
    return result;
}

/**
 * **还原 JSON 结构**
 */
function unFlattenObject(data) {
    const result = {};
    for (const key in data) {
        const keys = key.split('.');
        let curr = result;

        for (let i = 0; i < keys.length; i++) {
            const isLast = i === keys.length - 1;
            const prop = /^\d+$/.test(keys[i]) ? parseInt(keys[i], 10) : keys[i];

            if (isLast) {
                curr[prop] = data[key];
            } else {
                if (!curr[prop]) {
                    curr[prop] = /^\d+$/.test(keys[i + 1]) ? [] : {};
                }
                curr = curr[prop];
            }
        }
    }
    return Object.keys(result).every(k => /^\d+$/.test(k)) ? Object.values(result) : result;
}

/**
 * **开始翻译**
 */
const startTranslation = async () => {
    const INPUT_FILE = path.join(__dirname, 'locales/source', 'source.json');
    console.log(`读取 ${INPUT_FILE}，开始翻译到 ${TARGET_LANG}...`);
    try {
        const sourceJson = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
        const translatedJson = await translateRun(sourceJson);
        const OUTPUT_FILE = path.join(__dirname, 'locales/target', `${TARGET_LANG}.json`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(translatedJson, null, 2));
        console.log(`翻译完成，结果已写入 ${OUTPUT_FILE}`);
    } catch (err) {
        console.error(`读取或解析输入文件失败: ${err.message}`);
    }
};

/**
 * **用户选择翻译语言**
 */
const askLanguage = async () => {
    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'language',
            message: '请选择翻译目标语言:',
            choices: LANGUAGE_OPTIONS
        }
    ]);
    TARGET_LANG = answer.language;
    console.log(`\n目标语言设为: ${TARGET_LANG}`);
    await startTranslation();
};

// **启动语言选择**
askLanguage();
