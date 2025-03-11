const fs = require('fs');
const googleTranslate = require('@vitalets/google-translate-api');

const INPUT_FILE = './source.json';          // 输入 JSON 文件
const OUTPUT_FILE = './target/zh.json';  // 输出 JSON 文件
const SOURCE_LANG = 'en';                    // 源语言
const TARGET_LANG = 'zh-CN';                 // 目标语言

const TRANSLATE_FIELDS = ['title', 'content'];

/**
 * 扁平化 JSON 对象或数组
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
 * 还原扁平化对象为 JSON 结构，确保根级别数组不会变成对象
 */
function unflattenObject(data) {
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

    // **修正：如果整个结构的键是从 0 开始的数字，说明根级别应是数组**
    const isRootArray = Object.keys(result).every(k => /^\d+$/.test(k));
    return isRootArray ? Object.values(result) : result;
}

/**
 * 批量翻译 title 字段
 */
const batchTranslate = async (fields) => {
    console.log(`开始批量翻译 ${fields.length} 个字段`);
    let result = {};
    for (const { key, value } of fields) {
        const translated = await googleTranslate(value, { from: SOURCE_LANG, to: TARGET_LANG });
        result[key] = translated.text;
        console.log(`翻译 "${value}" => "${translated.text}"`);
    }
    return result;
};

/**
 * 翻译 HTML 内容
 */
const safeTranslate = async (text) => {
    const regex = /<[^>]*?>/gi;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
        const textSegment = text.slice(lastIndex, match.index);
        if (textSegment) segments.push({ type: 'text', content: textSegment });
        segments.push({ type: 'html', content: match[0] });
        lastIndex = regex.lastIndex;
    }
    const finalSegment = text.slice(lastIndex);
    if (finalSegment) segments.push({ type: 'text', content: finalSegment });

    const translatedSegments = await Promise.all(
        segments.map(async seg => seg.type === 'text' ? (await googleTranslate(seg.content, { from: SOURCE_LANG, to: TARGET_LANG })).text : seg.content)
    );

    return translatedSegments.join('');
};

/**
 * 翻译 JSON 数据
 */
const translateRun = async (inputJson) => {
    const flat = flattenObject(inputJson);
    const normalFields = [];
    const richFields = [];

    for (const key in flat) {
        const lastKey = key.split('.').pop();
        if (TRANSLATE_FIELDS.includes(lastKey)) {
            if (lastKey === 'content') {
                richFields.push({ key, value: flat[key] });
            } else {
                normalFields.push({ key, value: flat[key] });
            }
        }
    }

    const normalTranslations = await batchTranslate(normalFields);
    const richTranslations = {};
    for (const { key, value } of richFields) {
        richTranslations[key] = await safeTranslate(value);
    }

    return unflattenObject({ ...flat, ...normalTranslations, ...richTranslations });
};

// **运行翻译**
console.log(`读取 ${INPUT_FILE} 文件，开始翻译...`);

try {
    // 读取 JSON 文件
    const sourceJson = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));

    // 执行翻译
    translateRun(sourceJson).then(resultJson => {
        // 确保输出目录存在
        const outputDir = OUTPUT_FILE.substring(0, OUTPUT_FILE.lastIndexOf('/'));
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // 写入翻译后的 JSON 文件
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(resultJson, null, 2));
        console.log(`翻译完成，结果已写入 ${OUTPUT_FILE}`);
    }).catch(console.error);
} catch (err) {
    console.error('读取或解析输入文件失败:', err);
}
