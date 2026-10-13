import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildStandaloneHtml, inlineJson, standaloneTemplate } from '../src/lib/standalone';
import { paragraphs } from '../src/player/Player';
import { lighthouse } from '../src/samples/lighthouse';

const TEMPLATE = '<title>__STORY_TITLE__</title><meta name="description" content="__STORY_DESCRIPTION__"><script id="story-data" type="application/json">__STORY_DATA__</script>';

describe('혼자 실행되는 HTML 파일', () => {
  it('작품을 JSON으로 끼워 넣고, 제목과 소개를 안전하게 넣는다', () => {
    const pkg = structuredClone(lighthouse);
    pkg.meta.title = '<b>"등대" & 밤</b>';
    pkg.events[0].text = '</script><script>alert(1)</script> 안녕';
    const html = buildStandaloneHtml(pkg, TEMPLATE);
    expect(html).toContain('<title>&lt;b&gt;&quot;등대&quot; &amp; 밤&lt;/b&gt;</title>');
    expect(html).not.toContain('</script><script>alert');
    const json = /<script id="story-data" type="application\/json">([\s\S]*)<\/script>/.exec(html)![1];
    const back = JSON.parse(json);
    expect(back.meta.title).toBe(pkg.meta.title);
    expect(back.events[0].text).toBe(pkg.events[0].text);
    expect(back.events.length).toBe(pkg.events.length);
  });

  it('달러 기호가 든 글도 그대로 들어간다', () => {
    const pkg = structuredClone(lighthouse);
    pkg.meta.description = "$& $1 $' $$";
    const html = buildStandaloneHtml(pkg, TEMPLATE);
    expect(html).toContain(`content="$&amp; $1 $' $$"`);
  });

  it('원작자가 있는 사본이면 작가 칸이 "원작자, 복사자"로 나간다', () => {
    const pkg = structuredClone(lighthouse);
    pkg.meta.author = '복사자';
    pkg.meta.credits = ['원작자'];
    const html = buildStandaloneHtml(pkg, TEMPLATE);
    expect(JSON.parse(/application\/json">([\s\S]*)<\/script>/.exec(html)![1]).meta.author).toBe('원작자, 복사자');
  });

  it('JSON에서 줄 구분 문자도 이스케이프한다', () => {
    const LS = String.fromCharCode(0x2028);
    const PS = String.fromCharCode(0x2029);
    const out = inlineJson({ a: `${LS}${PS}<` });
    expect(out.includes(LS) || out.includes(PS) || out.includes('<')).toBe(false);
    expect(JSON.parse(out).a).toBe(`${LS}${PS}<`);
  });

  it('빌드한 틀이 있으면 자리표시자가 모두 남아 있다(없으면 건너뜀)', () => {
    const t = standaloneTemplate();
    if (!t) return;
    for (const k of ['__STORY_TITLE__', '__STORY_DESCRIPTION__', '__STORY_DATA__']) expect(t.split(k).length - 1, k).toBe(1);
  });
});

describe('--- 구분선', () => {
  const html = (t: string) => renderToStaticMarkup(<>{paragraphs(t)}</>);
  it('--- 한 줄은 얇은 구분선이 된다', () => {
    expect(html('앞 글\n---\n뒷 글')).toBe('<p>앞 글</p><hr class="prose-rule"/><p>뒷 글</p>');
    expect(html('앞 글\n-----\n뒷 글')).toContain('<hr class="prose-rule"/>');
  });
  it('글자가 나타나는 중의 -, -- 는 아직 아무것도 그리지 않는다', () => {
    expect(html('앞 글\n-')).toBe('<p>앞 글</p>');
    expect(html('앞 글\n--')).toBe('<p>앞 글</p>');
  });
  it('문장 속 하이픈이나 다른 글자가 섞인 줄은 그대로 글이다', () => {
    expect(html('가-나')).toBe('<p>가-나</p>');
    expect(html('--- 끝')).toBe('<p>--- 끝</p>');
  });
});
