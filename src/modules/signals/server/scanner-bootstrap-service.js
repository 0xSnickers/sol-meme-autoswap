export function createScannerBootstrapService({
  ensureStrategySessionMeta,
  formatPaperTradePolicyLabel,
  getStoredPaperTradeSettings,
  log,
  minSmartDegenCount,
  paperBasePositionUsd,
  paperMaxCapitalUsagePct,
  paperMaxOpenPositions,
  pushMinBuySellRatio,
  pushMinHolders,
  pushMinLiquidity,
  pushMinVolume,
  requireSocials,
  scanInterval,
  scanNarratives,
  sleep,
  tgSend,
  tradeRules,
}) {
  async function runMain(argv = process.argv) {
    await ensureStrategySessionMeta(null, { reset: true });
    const startupTradeSettings = await getStoredPaperTradeSettings();

    log('='.repeat(50));
    log('链上雷达 Node.js 版启动');
    log(`扫描间隔: ${scanInterval}s`);
    log('推送逻辑: 动量优先 — 连涨才推，叙事只做分类标签');
    log(
      `核心规则: 30秒仅扫描SOL，连涨3轮且涨幅>=5%，聪明钱>=${minSmartDegenCount}，流动性>=${pushMinLiquidity}，持有人>=${pushMinHolders}，1h量>=${pushMinVolume}，买卖比>=${pushMinBuySellRatio}`
    );
    log(
      `交易风控: score>=${tradeRules.scoreThreshold}，仅第1次信号，最多${paperMaxOpenPositions}个持仓，资金使用率<=${paperMaxCapitalUsagePct}%，基础仓位${paperBasePositionUsd} USD，${formatPaperTradePolicyLabel(startupTradeSettings)}`
    );
    log('='.repeat(50));

    await tgSend(
      '链上雷达 Node.js 版已启动\n\n' +
        '核心逻辑: 动量优先\n' +
        `连涨3轮+涨幅>=5%且聪明钱>=${minSmartDegenCount}才推送\n` +
        '扫描范围: 仅SOL\n' +
        `质量门槛: 流动性>=${pushMinLiquidity} | 持有人>=${pushMinHolders} | 1h量>=${pushMinVolume} | 买卖比>=${pushMinBuySellRatio}\n` +
        `交易风控: score>=${tradeRules.scoreThreshold} | 仅第1次信号 | 最多${paperMaxOpenPositions}仓 | 资金使用率<=${paperMaxCapitalUsagePct}% | 基础仓位${paperBasePositionUsd} USD | ${formatPaperTradePolicyLabel(startupTradeSettings)}\n` +
        `社交要求: ${requireSocials ? '至少有1个社交/官网链接' : '关闭'}\n` +
        '叙事只做分类标签:\n' +
        '★★★ 马斯克/川普\n' +
        '★★ 名人热点 | 有叙事\n' +
        '★ 无明确叙事\n\n' +
        `扫描频率: 每${scanInterval}秒`
    );

    if (argv.includes('--once')) {
      const result = await scanNarratives({ deliver: true });
      log(`单轮扫描完成: 发现${result.found}个信号, 推送${result.pushed}个`);
      return;
    }

    let scanCount = 0;
    let totalPushed = 0;

    while (true) {
      try {
        scanCount += 1;
        const result = await scanNarratives({ deliver: true });
        totalPushed += result.pushed;

        if (result.pushed > 0) {
          log(
            `第${scanCount}轮: 发现${result.found}个, 推送${result.pushed}个 (累计推送${totalPushed})`
          );
        } else if (scanCount % 20 === 0) {
          log(`第${scanCount}轮: 无新信号 (累计推送${totalPushed})`);
        }
      } catch (error) {
        log(`扫描异常: ${error.message}`);
      }

      await sleep(scanInterval * 1000);
    }
  }

  return {
    runMain,
  };
}
