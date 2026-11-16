import { MAIN_MIX_SET_ID } from '../engine/attempt';
import { setLabel } from './format';

describe('setLabel', () => {
  it('đề sub "Đề n", đề main "Main n", đề trộn "Main trộn"', () => {
    expect(setLabel(3)).toBe('Đề 3');
    expect(setLabel(105)).toBe('Main 5');
    expect(setLabel(MAIN_MIX_SET_ID)).toBe('Main trộn');
  });
});
