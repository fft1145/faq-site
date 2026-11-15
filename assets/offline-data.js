/**
 * 内置 FAQ 题库（只读兜底）
 * 当后端接口不可用时，页面仍然可以正常展示常见问题。
 * 后端上线后，接口数据会覆盖这里的静态内容。
 */
window.FFT_FALLBACK_FAQ = {
  site: {
    title: 'FFT 统一 FAQ 中心',
    subtitle: 'Better CMD、BMCL 与 Minecraft 服务器的常见问题，在这里一次找到答案。',
    notice: '提问前请先搜索已有问题；发表评论需登录 FFT 账号。'
  },
  items: [
    {
      id: 'faq-seed-1',
      category: 'bcmd',
      question: 'Better CMD 的系统要求是什么？',
      answer: 'Better CMD 目前面向 Windows 平台发布，支持 Windows 10 / 11（64 位）。下载得到的压缩包解压后即可运行，不需要安装额外运行库，也不需要管理员权限。\n\n如果你使用的是较旧的 Windows 版本，建议先在虚拟机或备用电脑上测试。',
      order: 1
    },
    {
      id: 'faq-seed-2',
      category: 'bcmd',
      question: 'Better CMD 是免费开源的吗？',
      answer: '是的。Better CMD 完全开源免费，你可以自由下载、使用与分发，也可以在 GitHub 上查看源码、提交改进。项目地址：github.com/fft1145/Better-CMD，许可证为 Apache-2.0。\n\n项目不提供任何付费版本，也不需要激活码。',
      order: 2
    },
    {
      id: 'faq-seed-3',
      category: 'bcmd',
      question: '如何反馈 Better CMD 的问题或建议？',
      answer: '可以在本页对应条目下方登录后留言，也可以前往 GitHub Issues 提交问题：github.com/fft1145/Better-CMD/issues。\n\n反馈时请尽量附上系统版本、Better CMD 版本、复现步骤和截图，这些信息能帮助我们更快定位问题。',
      order: 3
    },
    {
      id: 'faq-seed-4',
      category: 'bmcl',
      question: 'BMCL 需要自建服务器或一直联网吗？',
      answer: '不需要自建服务器。BMCL 与游戏都完全运行在本机，日常启动已安装的版本不依赖在线服务。\n\n首次下载版本清单与游戏资源时需要网络，可借助内置的 BMCLAPI 国内镜像加速；准备完成后可以使用离线登录进入游戏。',
      order: 4
    },
    {
      id: 'faq-seed-5',
      category: 'bmcl',
      question: 'BMCL 更新会覆盖我的存档或模组吗？',
      answer: '不会。BMCL 从 GitHub 检查更新，更新过程采用白名单：只替换启动器自身的文件。\n\nsaves/、mods/、versions/、libraries/、assets/ 以及 options.txt 等游戏内容都不在覆盖范围内，存档、模组、整合包与已安装版本会保持原样。',
      order: 5
    },
    {
      id: 'faq-seed-6',
      category: 'bmcl',
      question: 'BMCL 需要哪个 Java 版本？',
      answer: 'BMCL 不自带 Java，请在本机安装与游戏版本匹配的 Java 运行时：\n\n· Minecraft 1.16 及以下：Java 8\n· Minecraft 1.17 及以上：Java 17\n· Minecraft 1.20.5 及以上：建议 Java 21\n\n版本越高对 Java 的要求也越高，装错 Java 是启动失败最常见的原因。启动失败时可以先使用设置页内置的崩溃自检确认问题来源。',
      order: 6
    },
    {
      id: 'faq-seed-7',
      category: 'bmcl',
      question: '运行 BMCL 时出现 SmartScreen 警告怎么办？',
      answer: 'BMCL 的 portable exe 没有代码签名，首次运行时 Windows 可能显示「Windows 已保护你的电脑」。\n\n请先确认文件来自官方 GitHub Releases（github.com/fft1145/BMCL），确认后点击「更多信息」→「仍要运行」即可。如果文件来源不明，请删除并重新从官方渠道下载。',
      order: 7
    }
  ]
};
