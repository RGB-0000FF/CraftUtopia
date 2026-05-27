# CraftUtopia Demo Talk Tracks

这些稿子不是讲网站怎么用，而是讲现场 demo 时 audience 应该看哪里、在什么节点听到什么重点。

## Version A: Full Demo, 90-120 Seconds

适合没有 overview 的场景。节奏是先让观众理解输入和分工，再把注意力拉到 skill learning。

1. Opening image/blueprint, 0-10s  
   让观众先看左侧视频开头的目标建筑和 blueprint cover。讲法：这个 demo 从一张建筑图片开始，CraftUtopia 把它转成 Minecraft blueprint，再切成 Region A-E。这里不要解释太细，只需要让观众知道系统已经有了可执行的建造目标。

2. Region split, 10-25s  
   让观众看右侧 Milestones 和 log 里 Foreman-A 到 Foreman-E 的出现。讲法：五个 Foreman 同时接管五个区域，每个 Foreman 再把区域拆成 worker subplans。这里的重点不是单个 agent，而是 100 个 agents 可以被组织成并行协作结构。

3. First repeated work, 25-45s  
   让观众看右侧 log 里的 `trace:` 和左侧视频里重复的放置行为。讲法：前几批 workers 还没有现成 skill，所以他们按 subplan 一步步执行；当相似轨迹重复出现，系统开始收集 trace。这里要点出：trace 是后面 learned skill 的原料。

4. Skill appears, 45-70s  
   让观众看左侧 Skill Library 和右侧 batch summary 里的 `SKILL` tag。讲法：当 trace 足够稳定，ProjectManager 会把重复流程抽象成 `Region Placement`，发布到 Skill Library，后续 workers 遇到相似任务时直接复用。这里是 demo 的第一个核心点：skill 不是预置脚本，而是在协作中长出来的 reusable workflow。

5. More skills, 70-95s  
   让观众继续看 Skill Library 的新增 icon，不要逐条读完整 log。讲法：`Scaffold Construction` 处理高处临时支撑，`Region Replacement` 处理错误方块替换，`Region Cleaning` 处理最后的残留支撑清理。每个 skill 都来自重复 trace，然后反过来加速后面的 workers。

6. Final verification, 95-120s  
   让观众看右侧 progress 接近完成和左侧建筑成型。讲法：最后 ProjectManager 做 blueprint comparison，Foreman-A 到 Foreman-E 回报区域完成。收尾强调：这个 demo 展示的是 100-agent collaboration 如何把重复劳动转成 shared skill library，从而让后续建造越来越快。

## Version B: After Overview, 45-60 Seconds

适合已经介绍过系统架构之后，现场只需要把观众带进这个具体 demo。

1. 0-10s  
   指向左侧视频：这里是从建筑图片到可建造 blueprint，再切成五个 regions 并行推进。

2. 10-25s  
   指向右侧 log：注意看 `trace:`，这表示 workers 正在重复执行相似 subplans，系统正在收集可学习的行为轨迹。

3. 25-45s  
   指向左侧 Skill Library：当 `Region Placement`、`Scaffold Construction`、`Region Replacement`、`Region Cleaning` 出现时，说明重复 trace 已经被抽象成 skill，并开始服务后面的 workers。

4. 45-60s  
   指向右侧 batch summary：`SKILL` tag 表示这批任务复用了 learned workflow；没有 tag 的行就是普通执行或继续收集 trace。最后一句落点：重点不是某个 worker 会建造，而是整个 100-agent system 会在建造过程中学习和复用。

## Version C: Fast Conference Clip, 25-35 Seconds

适合时间非常紧，只抓一个核心 punchline。

看左侧，100 个 agents 正在把图片生成的 blueprint 建成 Minecraft 结构；看右侧，系统把任务拆给 Foreman 和 workers 并行执行。重点看 `trace:` 和左侧 Skill Library：重复的 worker 行为先变成 trace，然后被总结成 `SKILL`，再被后续 workers 复用。这里出现的四个 skill 分别覆盖普通放置、高处支撑、错误替换和最终清理。这个 demo 的核心是：CraftUtopia 在建造过程中动态形成 shared skill library，让 100-agent 协作越做越快。
