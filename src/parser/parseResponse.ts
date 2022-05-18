import type {
	BookReview,
	ChapterHighlight,
	ChapterReview,
	Highlight,
	Metadata,
	Review
} from 'src/models';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import moment from 'moment';

export const parseMetadata = (noteBook: any): Metadata => {
	const book = noteBook['book'];
	const cover: string = book['cover'].replace('/s_', '/t9_');
	const metaData: Metadata = {
		bookId: book['bookId'],
		author: book['author'],
		title: book['title'],
		url: book['url'],
		cover: cover,
		publishTime: book['publishTime'],
		noteCount: noteBook['noteCount'],
		reviewCount: noteBook['reviewCount']
	};
	return metaData;
};

export const parseHighlights = (highlightData: any, reviewData: any): Highlight[] => {
	const chapters: [] = highlightData['chapters'];
	const chapterMap = new Map(
		chapters.map((chapter) => [chapter['chapterUid'], chapter['title']] as [string, string])
	);
	const highlights: [] = highlightData['updated'];
	const reviews: [] = reviewData['reviews'];

	return highlights.map((highlight) => {
		const chapterUid = highlight['chapterUid'];
		const created = highlight['createTime'];
		const createTime = moment(created * 1000).format('YYYY-MM-DD HH:mm:ss');
		const highlightRange = highlight['range'];
		const review = reviews
			.map((review) => review['review'])
			.filter((review) => review['range'] === highlightRange)
			.first();
		let reviewContent;
		if (review) {
			reviewContent = review['content'];
		}
		const bookmarkId: string = highlight['bookmarkId'];
		return {
			bookmarkId: bookmarkId.replace('_', '-'),
			created: created,
			createTime: createTime,
			chapterUid: highlight['chapterUid'],
			range: highlight['range'],
			chapterTitle: chapterMap.get(chapterUid),
			markText: highlight['markText'],
			reviewContent: reviewContent
		};
	});
};

export const parseChapterHighlights = (highlights: Highlight[]): ChapterHighlight[] => {
	const chapterResult: ChapterHighlight[] = [];
	for (const highlight of highlights) {
		const chapterUid = highlight['chapterUid'];
		const chapterTitle = highlight['chapterTitle'];
		const existChapter = chapterResult.find(
			(chapter) => chapter.chapterUid == highlight.chapterUid
		);
		const reviewCount = highlight.reviewContent ? 1 : 0;
		if (existChapter == null) {
			const currentHighlight = [highlight];
			const chapter = {
				chapterUid: chapterUid,
				chapterTitle: chapterTitle,
				chapterReviewCount: reviewCount,
				highlights: currentHighlight
			};
			chapterResult.push(chapter);
		} else {
			existChapter.chapterReviewCount += reviewCount;
			existChapter.highlights.push(highlight);
		}
	}
	chapterResult.forEach((chapter) =>
		chapter.highlights.sort((o1, o2) => o1.created - o2.created)
	);
	return chapterResult.sort((o1, o2) => o1.chapterUid - o2.chapterUid);
};

export const parseReviews = (data: any): Review[] => {
	const reviews: [] = data['reviews'];
	return reviews.map((reviewData) => {
		const review = reviewData['review'];
		const created = review['createTime'];
		const createTime = moment(created * 1000).format('YYYY-MM-DD HH:mm:ss');
		const htmlContent = review['htmlContent'];
		const mdContent = htmlContent ? NodeHtmlMarkdown.translate(htmlContent) : null;
		const reviewId: string = review['reviewId'];
		return {
			bookId: review['bookId'],
			created: created,
			createTime: createTime,
			chapterUid: review['chapterUid'],
			chapterTitle: review['chapterTitle'],
			content: review['content'],
			reviewId: reviewId.replace('_', '-'),
			mdContent: mdContent,
			range: review['range'],
			abstract: review['abstract'],
			type: review['type']
		};
	});
};

export const parseChapterReviews = (reviewData: any): BookReview => {
	const reviews = parseReviews(reviewData);

	const chapterReviews = reviews
		.filter((review) => review.type == 1)
		.sort((o1, o2) => o2.created - o1.created);

	const entireReview = reviews.filter((review) => review.type == 4).first();
	console.log('=================', reviews, chapterReviews, entireReview);
	const chapterResult = new Map();
	for (const review of chapterReviews) {
		const chapterUid = review['chapterUid'];
		const chapterTitle = review['chapterTitle'];
		const existChapter = chapterResult.get(review.chapterUid);
		if (existChapter == null) {
			const chapter: ChapterReview = {
				chapterUid: chapterUid,
				chapterTitle: chapterTitle,
				reviews: []
			};
			if (review.range) {
				chapter.reviews.push(review);
			} else {
				chapter.chapterReview = review;
			}
			chapterResult.set(review.chapterUid, chapter);
		} else {
			const chapterRview: ChapterReview = chapterResult.get(review.chapterUid);
			if (review.range) {
				chapterRview.reviews.push(review);
			} else {
				chapterRview.chapterReview = review;
			}
		}
	}
	const chapterReviewResult: ChapterReview[] = Array.from(chapterResult.values()).sort(
		(o1, o2) => o1.chapterUid - o2.chapterUid
	);
	console.log('++++++++', chapterReviewResult);
	return {
		bookReview: entireReview,
		chapterReviews: chapterReviewResult
	};
};
