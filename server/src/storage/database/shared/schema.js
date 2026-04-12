import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, index, jsonb } from "drizzle-orm/pg-core";
// 保留系统表
export const healthCheck = pgTable("health_check", {
    id: integer("id").notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
// 词库表
export const vocabBooks = pgTable("vocab_books", {
    id: varchar("id", { length: 36 }).primaryKey().default(sql `gen_random_uuid()`),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    level: varchar("level", { length: 50 }).notNull(),
    total_words: integer("total_words").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [index("vocab_books_level_idx").on(table.level)]);
// 词汇表
export const words = pgTable("words", {
    id: varchar("id", { length: 36 }).primaryKey().default(sql `gen_random_uuid()`),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    word: varchar("word", { length: 100 }).notNull(),
    phonetic: varchar("phonetic", { length: 100 }),
    meaning: text("meaning").notNull(),
    example_sentence: text("example_sentence"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("words_book_id_idx").on(table.book_id),
    index("words_word_idx").on(table.word),
]);
// 小说表
export const novels = pgTable("novels", {
    id: varchar("id", { length: 36 }).primaryKey().default(sql `gen_random_uuid()`),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    cover_image: text("cover_image"),
    summary: text("summary"),
    chapter_count: integer("chapter_count").notNull().default(1),
    word_count: integer("word_count").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    index("novels_book_id_idx").on(table.book_id),
    index("novels_created_at_idx").on(table.created_at),
]);
// 小说词汇关系表
export const novelWords = pgTable("novel_words", {
    id: varchar("id", { length: 36 }).primaryKey().default(sql `gen_random_uuid()`),
    novel_id: varchar("novel_id", { length: 36 }).notNull().references(() => novels.id, { onDelete: "cascade" }),
    word_id: varchar("word_id", { length: 36 }).notNull().references(() => words.id, { onDelete: "cascade" }),
    position: integer("position"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    index("novel_words_novel_id_idx").on(table.novel_id),
    index("novel_words_word_id_idx").on(table.word_id),
]);
// 用户小说表
export const userNovels = pgTable("user_novels", {
    id: varchar("id", { length: 36 }).primaryKey().default(sql `gen_random_uuid()`),
    title: varchar("title", { length: 200 }).notNull(),
    original_content: text("original_content").notNull(),
    processed_content: text("processed_content"),
    book_id: varchar("book_id", { length: 36 }).notNull().references(() => vocabBooks.id, { onDelete: "cascade" }),
    is_processed: boolean("is_processed").notNull().default(false),
    vocabulary_list: jsonb("vocabulary_list"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    index("user_novels_book_id_idx").on(table.book_id),
    index("user_novels_created_at_idx").on(table.created_at),
]);
