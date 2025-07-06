import { ethers } from 'ethers';
import fs from 'fs';

// Irys测试网配置
const IRYS_TESTNET_URL = "https://testnet-rpc.irys.xyz/v1/execution-rpc";
const CONTRACT_ADDRESS = "0xbff4ca71606c1a9ee4abde68647d2718d20fe358";
const MINT_DATA = "0x1249c58b";
const DEFAULT_GAS_LIMIT = 300000;

function loadPrivateKeys(filename = "private_keys.txt") {
    try {
        const content = fs.readFileSync(filename, 'utf8');
        const lines = content.split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(line => {
                // 支持0x开头的私钥，自动移除0x前缀
                if (line.startsWith('0x')) {
                    return line.substring(2);
                }
                return line;
            })
            .filter(line => line.length === 64); // 确保是64位十六进制字符串
        return lines;
    } catch (error) {
        console.error(`读取私钥文件失败: ${error.message}`);
        return [];
    }
}

async function getBalance(provider, address) {
    try {
        const balance = await provider.getBalance(address);
        const balanceEth = ethers.formatEther(balance);
        console.log(`钱包 ${address} 余额: ${balanceEth} IRYS`);
        return balanceEth;
    } catch (error) {
        console.error("获取余额失败:", error.message);
        return "0";
    }
}

async function mintNFT(provider, privateKey) {
    try {
        // 创建钱包
        const wallet = new ethers.Wallet(privateKey, provider);
        const address = wallet.address;
        console.log(`钱包地址: ${address}`);
        
        // 检查余额
        const balance = await getBalance(provider, address);
        const balanceNum = parseFloat(balance);
        
        if (balanceNum < 0.001) {
            console.log("❌ 余额不足，无法支付gas费用");
            return { success: false, message: "余额不足" };
        }
        
        // 构造交易数据
        const transaction = {
            to: CONTRACT_ADDRESS,
            data: MINT_DATA,
            gasLimit: 200000n
        };
        
        console.log(`合约地址: ${CONTRACT_ADDRESS}`);
        console.log(`交易数据: ${MINT_DATA}`);
        console.log(`使用默认gas限制: ${DEFAULT_GAS_LIMIT.toString()}`);
        
        // 使用默认gas限制
        transaction.gasLimit = DEFAULT_GAS_LIMIT;
        
        // 发送交易
        console.log("发送铸造交易...");
        let tx;
        let receipt;
        
        try {
            tx = await wallet.sendTransaction(transaction);
            console.log(`交易已发送: ${tx.hash}`);
            
            // 等待确认
            console.log("等待交易确认...");
            receipt = await tx.wait();
        } catch (error) {
            console.log(`交易发送失败: ${error.message}`);
            return { success: false, message: `交易失败: ${error.message}` };
        }
        
        if (receipt.status === 1) {
            console.log("✅ 铸造成功!");
            return { 
                success: true, 
                message: `铸造成功! 交易哈希: ${tx.hash}`,
                txHash: tx.hash
            };
        } else {
            console.log("❌ 交易失败");
            return { 
                success: false, 
                message: `交易失败: ${tx.hash}`,
                txHash: tx.hash
            };
        }
        
    } catch (error) {
        console.error("❌ 铸造异常:", error.message);
        return { success: false, message: error.message };
    }
}

async function batchMint() {
    console.log("=== Irys链 NFT 批量铸造工具 ===");
    
    // 创建provider
    const provider = new ethers.JsonRpcProvider(IRYS_TESTNET_URL);
    console.log("✅ 已连接到Irys测试网");
    
    // 加载私钥
    const privateKeys = loadPrivateKeys();
    if (privateKeys.length === 0) {
        console.log("错误: 没有找到有效的私钥");
        console.log("请确保 private_keys.txt 文件存在且包含有效的私钥");
        return;
    }
    
    console.log(`加载了 ${privateKeys.length} 个私钥`);
    
    const results = [];
    
    // 批量处理
    for (let i = 0; i < privateKeys.length; i++) {
        const privateKey = privateKeys[i];
        console.log(`\n${'='.repeat(50)}`);
        console.log(`处理第 ${i + 1}/${privateKeys.length} 个钱包`);
        
        const result = await mintNFT(provider, privateKey);
        results.push({
            wallet: i + 1,
            success: result.success,
            message: result.message,
            txHash: result.txHash
        });
        
        // 添加延迟
        if (i < privateKeys.length - 1) {
            const delay = Math.random() * 3000 + 2000; // 2-5秒
            console.log(`等待 ${(delay/1000).toFixed(1)} 秒...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    // 打印统计结果
    console.log(`\n${'='.repeat(50)}`);
    console.log("=== 铸造结果统计 ===");
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`总处理数量: ${totalCount}`);
    console.log(`成功数量: ${successCount}`);
    console.log(`失败数量: ${totalCount - successCount}`);
    console.log(`成功率: ${(successCount/totalCount*100).toFixed(1)}%`);
    
    // 保存结果
    const timestamp = Date.now();
    const resultFilename = `mint_results_${timestamp}.json`;
    
    const resultData = {
        timestamp: new Date().toISOString(),
        contractAddress: CONTRACT_ADDRESS,
        totalCount,
        successCount,
        failureCount: totalCount - successCount,
        successRate: (successCount/totalCount*100).toFixed(1),
        results
    };
    
    fs.writeFileSync(resultFilename, JSON.stringify(resultData, null, 2));
    console.log(`结果已保存到: ${resultFilename}`);
}

// 运行主函数
batchMint().catch(console.error);
