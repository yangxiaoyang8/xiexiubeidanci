/**
 * 快速预置示例小说
 * 为每个词库添加几篇预置小说
 */
import { getSupabaseClient } from '../src/storage/database/supabase-client.js';

const SAMPLE_NOVELS = [
  {
    title: '《城市之光》',
    content: `【第一章 初遇】

李明站在高楼的落地窗前，俯瞰着这座不夜城。霓虹灯闪烁，车水马龙，一切都显得那么 [beautiful]。

他刚刚结束了一天的工作，作为一名新入职的程序员，每天都在学习新的 [technology]。虽然很累，但他感到充实。

"Excuse me，请问这里是XX公司吗？"一个清脆的声音打断了他的思绪。

李明转过身，看到一个穿着白色连衣裙的女孩。她有着明亮的眼睛和温暖的 [smile]。

"是的，请问你找谁？"李明用流利的英语回答。

"我是来面试的，我叫小雨。"女孩有些紧张地说。

"别紧张，我们公司很 [friendly] 的。"李明安慰道，"我可以带你去HR部门。"

【第二章 成长】

时间过得很快，小雨成功加入了公司。她和李明成为了同事，一起完成了一个重要的 [project]。

在这个过程中，李明发现小雨不仅工作能力强，而且有着独特的 [creativity]。她总能提出新的想法，解决问题。

"你的 idea 真的很棒！"李明在一次会议后说。

"谢谢你的 [support]，"小雨笑着说，"有你的帮助，我才能完成。"

他们一起加班，一起讨论方案，一起分享 [success] 的喜悦。渐渐地，李明发现自己对小雨产生了特别的 [feeling]。

【第三章 挑战】

公司接到了一个重要的客户，要求在一个月内完成一个复杂的 [application]。这个项目对公司的 [development] 至关重要。

李明被任命为项目组长，小雨是核心成员。他们面临着巨大的 [pressure]。

"我们一定能 [succeed] 的！"小雨在团队会议上鼓励大家。

经过无数个日夜的努力，他们终于完成了项目。客户对结果非常 [satisfied]。

【第四章 约定】

项目成功后，李明鼓起勇气约小雨吃饭。

"我想和你分享一些 [important] 的事情，"李明认真地说。

小雨好奇地看着他。

"我喜欢你，从第一次见面就..." 李明说完，紧张地等待着她的 [response]。

小雨笑了，那笑容比任何时候都 [beautiful]。

"我也是，"她轻声说。

从那以后，他们成为了恋人，一起在这座城市追逐着各自的 [dream]。

【尾声】

多年后，李明和小雨创立了自己的 [company]。他们回忆起最初的相遇，感慨万千。

这座城市见证了他们的 [growth]，也见证了他们的爱情。

城市之光，永远闪耀。

— 完 —`,
    summary: '都市言情 | 李明 | 800字 | 20个词汇',
    genre: '都市言情',
  },
  {
    title: '《时间旅行者》',
    content: `【第一章 神秘的发现】

张伟是一名物理学家，他在实验室里做着关于 [time] 的研究。这一天，他发现了一个惊人的 [phenomenon]。

"这不可能..."他看着数据，完全不敢相信自己的 [eyes]。

实验显示，时间可以在特定条件下发生 [change]。这意味着时间旅行可能不再只是科幻小说中的 [story]。

【第二章 穿越】

经过多次实验，张伟终于成功制造出了时间机器。他决定亲自 [experience] 一次。

当他按下启动按钮的那一刻，周围的 [space] 开始扭曲。一道白光闪过，他失去了 [consciousness]。

当张伟再次睁开眼睛，他发现自己站在一条古老的街道上。周围的人都穿着古代的 [clothes]。

"这是...一千年前？"他惊讶地说。

【第三章 古代生活】

张伟必须在古代生存下去。他用自己有限的 [knowledge] 帮助当地人解决问题，逐渐获得了他们的 [trust]。

在这个过程中，他遇到了一个叫小芳的姑娘。她对这个"奇怪的外乡人"充满了 [curiosity]。

"你是从哪里来的？"小芳问。

"一个很远的 [place]，"张伟回答，"一个你们无法想象的地方。"

【第四章 归途】

经过努力，张伟终于修好了时间机器。但此时，他已经在古代生活了三年，和小芳产生了深厚的 [emotion]。

"我必须回去了，"张伟对他说，"那里有我的家人，我的 [life]。"

小芳流下了眼泪，但她理解他的决定。

"我会永远 [remember] 你，"她说。

【尾声】

张伟回到了现代。他的 [research] 取得了巨大的成功，但他心中永远留下了一段难忘的 [memory]。

时间可以改变一切，但真挚的感情，永远不会消失。

— 完 —`,
    summary: '科幻未来 | 张伟 | 700字 | 20个词汇',
    genre: '科幻未来',
  },
  {
    title: '《校园记忆》',
    content: `【第一章 开学】

九月的阳光洒在校园里，王芳拖着行李箱走进了大学校门。这是她期待已久的 [moment]。

"需要帮忙吗？"一个男生走过来问。他有着阳光般的 [character]，让人感到温暖。

"谢谢，我叫王芳。"她微笑着回答。

"我叫李阳，大三的学长。欢迎来到我们的 [university]！"

【第二章 社团】

王芳加入了英语角，在这里她认识了很多志同道合的 [friend]。他们一起练习口语，分享学习的 [method]。

李阳经常来英语角帮忙，他和王芳的 [relationship] 越来越好。

"你的英语进步很快，"李阳在一次活动后说，"继续保持这份 [passion]！"

【第三章 挑战】

期末考试来临，王芳感到很大的 [stress]。高等数学让她头疼不已。

"我来帮你，"李阳主动提出，"我们一起 [study]。"

在李阳的帮助下，王芳不仅通过了考试，还取得了不错的 [result]。

【第四章 告白】

毕业季来临，李阳决定向王芳表达自己的 [love]。

"四年了，看着你从青涩变得成熟，"李阳在校园的湖边说，"我想陪你走过以后的每一个 [stage]。"

王芳感动得流下了眼泪。

"我愿意，"她轻声说。

【尾声】

多年后，王芳和李阳再次回到校园。看着熟悉的一草一木，他们回忆起美好的 [memory]。

青春是一本打开就合不上的书，而他们的故事，还在继续。

— 完 —`,
    summary: '校园青春 | 王芳 | 600字 | 20个词汇',
    genre: '校园青春',
  }
];

async function main() {
  console.log('📚 开始添加预置小说...\n');

  const client = getSupabaseClient();

  // 获取所有词库
  const { data: books, error: booksError } = await client
    .from('vocab_books')
    .select('*');

  if (booksError || !books) {
    console.error('获取词库失败:', booksError);
    process.exit(1);
  }

  console.log(`📖 共有 ${books.length} 个词库\n`);

  for (const book of books) {
    console.log(`\n处理词库: ${book.name}`);

    // 检查现有小说数量
    const { data: existingNovels } = await client
      .from('novels')
      .select('id')
      .eq('book_id', book.id);

    const currentCount = existingNovels?.length || 0;
    console.log(`  当前小说数: ${currentCount}`);

    // 为每个词库添加示例小说
    for (let i = 0; i < SAMPLE_NOVELS.length; i++) {
      const novel = SAMPLE_NOVELS[i];
      const novelTitle = `${book.name}-${novel.title}`;

      // 检查是否已存在
      const { data: exists } = await client
        .from('novels')
        .select('id')
        .eq('book_id', book.id)
        .eq('title', novelTitle)
        .maybeSingle();

      if (exists) {
        console.log(`  ✓ 已存在: ${novelTitle}`);
        continue;
      }

      // 插入小说
      const { data: insertedNovel, error } = await client
        .from('novels')
        .insert({
          book_id: book.id,
          title: novelTitle,
          content: novel.content,
          summary: `${novel.summary} | ${book.name}`,
          chapter_count: 4,
          word_count: novel.content.length
        })
        .select()
        .single();

      if (error) {
        console.error(`  ✗ 插入失败:`, error.message);
        continue;
      }

      // 获取该词库的一些词汇并关联
      const { data: words } = await client
        .from('words')
        .select('id')
        .eq('book_id', book.id)
        .limit(20);

      if (words && words.length > 0 && insertedNovel) {
        const novelWordsData = words.map((w, index) => ({
          novel_id: insertedNovel.id,
          word_id: w.id,
          position: index
        }));

        await client.from('novel_words').insert(novelWordsData);
      }

      console.log(`  ✓ 添加: ${novelTitle}`);
    }

    // 更新词库统计
    const { data: allNovels } = await client
      .from('novels')
      .select('id')
      .eq('book_id', book.id);

    // 这里不更新total_words，因为那是词汇数量
  }

  console.log('\n\n🎉 预置小说添加完成！');
  process.exit(0);
}

main().catch(console.error);
