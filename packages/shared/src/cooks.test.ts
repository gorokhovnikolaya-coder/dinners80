import { describe, expect, it } from 'vitest';

import {
  addCookPhotoRequestSchema,
  createCookRequestSchema,
  createCookResponseSchema,
  findOvertakenFriend,
  uploadCookPhotoResponseSchema,
  uploadShareCardResponseSchema,
} from './cooks.ts';

const path = 'cooks/00000000-0000-4000-8000-000000001002/0b6f7c1e-3d0a-4c55-9a7e-2f1d3c4b5a69.jpg';

describe('findOvertakenFriend', () => {
  const friends = [
    { name: 'Егор', countries: 5, dishes: 5 },
    { name: 'Жанна', countries: 8, dishes: 9 },
    { name: 'Зоя', countries: 11, dishes: 11 },
  ];

  it('names the friend the user had as many countries as and now passes', () => {
    expect(findOvertakenFriend(8, 9, friends)).toBe('Жанна');
  });

  it('is null when the user was already ahead or is still behind', () => {
    expect(findOvertakenFriend(6, 7, friends)).toBeNull();
    expect(findOvertakenFriend(9, 10, friends)).toBeNull();
  });

  it('is null for a cook without a new country, even when tied', () => {
    expect(findOvertakenFriend(8, 8, friends)).toBeNull();
  });

  it('is null without friends', () => {
    expect(findOvertakenFriend(0, 1, [])).toBeNull();
  });

  it('picks the highest-ranked of several: more dishes, then by name', () => {
    const tied = [
      { name: 'Яна', countries: 3, dishes: 4 },
      { name: 'Борис', countries: 3, dishes: 7 },
      { name: 'Алла', countries: 3, dishes: 7 },
    ];
    expect(findOvertakenFriend(3, 4, tied)).toBe('Алла');
    expect(findOvertakenFriend(3, 4, tied.slice(0, 1))).toBe('Яна');
  });

  it('counts a friend with zero countries for the first stamp', () => {
    expect(findOvertakenFriend(0, 1, [{ name: 'Ира', countries: 0, dishes: 0 }])).toBe('Ира');
  });
});

describe('cook schemas', () => {
  it('accepts a cook with or without a photo', () => {
    expect(createCookRequestSchema.parse({ dishId: 'pe-ceviche' })).toEqual({
      dishId: 'pe-ceviche',
    });
    expect(createCookRequestSchema.parse({ dishId: 'pe-ceviche', photoPath: null }).photoPath).toBe(
      null,
    );
    expect(createCookRequestSchema.parse({ dishId: 'pe-ceviche', photoPath: path }).photoPath).toBe(
      path,
    );
  });

  it('rejects a photo path outside the private folder', () => {
    for (const photoPath of ['share/x.jpg', '../etc/passwd', `${path}.png`, 'cooks/a/b.jpg']) {
      expect(createCookRequestSchema.safeParse({ dishId: 'x', photoPath }).success).toBe(false);
      expect(uploadCookPhotoResponseSchema.safeParse({ photoPath }).success).toBe(false);
      expect(addCookPhotoRequestSchema.safeParse({ photoPath }).success).toBe(false);
    }
    expect(addCookPhotoRequestSchema.parse({ photoPath: path }).photoPath).toBe(path);
  });

  it('accepts a share card URL in the public folder only', () => {
    const name = '0b6f7c1e-3d0a-4c55-9a7e-2f1d3c4b5a69.jpg';
    for (const url of [`/media/share/${name}`, `https://example.com/media/share/${name}`])
      expect(uploadShareCardResponseSchema.parse({ url }).url).toBe(url);
    for (const url of [`/media/cooks/${name}`, '/media/share/x.jpg', `/media/share/${name}?a`])
      expect(uploadShareCardResponseSchema.safeParse({ url }).success).toBe(false);
  });

  it('parses the cook result', () => {
    const result = {
      cookId: 'c1',
      newCountry: true,
      countriesCount: 9,
      countriesTotal: 30,
      dishesCount: 13,
      overtook: 'Жанна',
    };
    expect(createCookResponseSchema.parse(result)).toEqual(result);
    expect(createCookResponseSchema.safeParse({ ...result, dishesCount: 0 }).success).toBe(false);
  });
});
