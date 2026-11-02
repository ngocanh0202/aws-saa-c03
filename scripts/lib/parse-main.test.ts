import { buildMainSet, findMainTwins, htmlToText, mainQuestionId, sortMainFiles } from './parse-main';

const raw = (text: string, answer: number[] = [1]) => ({
  question: `<p>${text}</p>`,
  options: ['<p>Opt A</p>', '<p>Opt B</p>', '<p>Opt C</p>'],
  correctAnswerIndices: answer,
  explanation: '<p>Because.</p>',
});

describe('parse-main', () => {
  it('sắp file theo phần rồi nửa: pt1_1, pt1_2, pt2_1, …, pt10_1', () => {
    expect(sortMainFiles(['pt2_1.json', 'pt10_1.json', 'pt1_2.json', 'pt1_1.json'])).toEqual(['pt1_1.json', 'pt1_2.json', 'pt2_1.json', 'pt10_1.json']);
  });

  it('dựng đề: id đề 101+, id câu = setId*100 + vị trí, đáp án theo chỉ số → chữ cái gốc', () => {
    const { set, questions } = buildMainSet('pt1_1.json', 0, [raw('One'), raw('Two (Select two)', [0, 2])]);
    expect(set).toEqual({ id: 101, file: 'pt1_1.json', title: 'Main 1', questionIds: [10101, 10102] });
    expect(questions[1]).toMatchObject({ id: 10102, answer: ['A', 'C'], choose: 2, html: true, prompt: '' });
    expect(questions[0].options.map((o) => o.key)).toEqual(['A', 'B', 'C']);
    expect(mainQuestionId(112, 65)).toBe(11265);
  });

  it('tìm câu trùng nguyên văn kể cả khi lựa chọn đổi thứ tự; câu khác lựa chọn thì không tính', () => {
    const a = buildMainSet('pt1_1.json', 0, [raw('Same'), raw('Other')]).questions;
    const b = buildMainSet('pt1_2.json', 1, [{ ...raw('Same'), options: ['<p>Opt C</p>', '<p>Opt A</p>', '<p>Opt B</p>'] }, { ...raw('Other'), options: ['<p>X</p>'] }]).questions;
    expect(findMainTwins([...a, ...b])).toEqual([[10101, 10201]]);
  });

  it('htmlToText bỏ thẻ, giải mã entity, thay ảnh bằng [ảnh]', () => {
    expect(htmlToText('<p>A &amp; B</p><img src="x.png"><p>C&nbsp;D</p>')).toBe('A & B\n[ảnh]C D');
  });
});
