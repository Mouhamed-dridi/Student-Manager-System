// "Ratings & reviews" block of the student course detail: the course average
// with its 5-to-1 distribution, a star + comment form the signed-in student
// can post, and every review written so far.
//
// Reviews are append-only (a student may post more than one) and the average
// spans all of them. Owns its own data so the course detail view stays
// presentational: it loads on mount, then keeps itself fresh through the
// course_reviews realtime channel and the tab-focus fallback.

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataError, DataLoading } from "@/components/DataState";
import { StarRatingDisplay, StarRatingInput } from "@/components/StarRating";
import { formatPublished } from "@/lib/courseDisplay";
import { addCourseReview, errorMessage, listCourseReviews, subscribeToTable } from "@/lib/api";
import type { CourseReview } from "@/lib/api";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";

const STARS = [5, 4, 3, 2, 1];

interface CourseReviewsSectionProps {
  courseId: string;
  studentId: string;
  studentName: string;
}

function averageOf(reviews: CourseReview[]): number {
  if (reviews.length === 0) return 0;
  const total = reviews.reduce((sum, r) => sum + r.rating, 0);
  return total / reviews.length;
}

function RatingSummary({ reviews }: { reviews: CourseReview[] }) {
  const average = averageOf(reviews);
  const counts = useMemo(() => {
    const map: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      if (r.rating >= 1 && r.rating <= 5) map[r.rating] += 1;
    }
    return map;
  }, [reviews]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="flex shrink-0 flex-col items-center gap-1 sm:w-32">
          <span className="text-5xl font-semibold tabular-nums">
            {average.toFixed(1)}
          </span>
          <StarRatingDisplay value={average} />
          <span className="text-xs text-muted-foreground">
            {reviews.length} rating{reviews.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="flex-1 space-y-1">
          {STARS.map((star) => {
            const count = counts[star];
            const percent =
              reviews.length === 0 ? 0 : (count / reviews.length) * 100;
            return (
              <div key={star} className="flex items-center gap-2 text-xs">
                <span className="flex w-9 shrink-0 items-center gap-0.5 text-muted-foreground">
                  {star}
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-amber-400"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CourseReviewsSection({
  courseId,
  studentId,
  studentName,
}: CourseReviewsSectionProps) {
  const [reviews, setReviews] = useState<CourseReview[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const list = await listCourseReviews(courseId);
      setReviews(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    listCourseReviews(courseId)
      .then((list) => {
        if (cancelled) return;
        setReviews(list);
        setLoadError(null);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    return subscribeToTable("course_reviews", () => void refresh());
  }, [refresh]);

  useRefetchOnFocus(() => {
    void refresh();
  });

  const submit = async () => {
    if (rating < 1) {
      setSubmitError("Pick a star rating before posting your review.");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      await addCourseReview({
        courseId,
        studentId,
        studentName,
        rating,
        comment,
      });
      setComment("");
      await refresh();
    } catch (err) {
      setSubmitError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <MessageSquare className="h-3.5 w-3.5" />
        Ratings &amp; reviews
      </h3>

      {reviews === null ? (
        !loadError && <DataLoading label="Loading reviews…" />
      ) : (
        <RatingSummary reviews={reviews} />
      )}

      <Card>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>
              Your rating
              <span className="ml-1 font-normal text-muted-foreground">
                (required)
              </span>
            </Label>
            <StarRatingInput
              value={rating}
              onChange={setRating}
              disabled={saving}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${courseId}-comment`}>
              Comment
              <span className="ml-1 font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id={`${courseId}-comment`}
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="What did you think of this course?"
              disabled={saving}
            />
          </div>
          {submitError ? (
            <p className="text-sm text-destructive">{submitError}</p>
          ) : null}
          <div className="flex items-center gap-3">
            <Button disabled={saving || rating < 1} onClick={submit}>
              {saving ? "Posting…" : "Post review"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Posted as {studentName || "student"}
            </span>
          </div>
        </CardContent>
      </Card>

      {loadError ? <DataError message={loadError} /> : null}

      {reviews !== null && reviews.length === 0 && !loadError ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet — be the first to rate this course.
        </p>
      ) : null}

      {reviews !== null && reviews.length > 0 ? (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-medium">
                  {review.studentName || "Student"}
                </span>
                <StarRatingDisplay value={review.rating} />
                <span className="text-xs text-muted-foreground">
                  {formatPublished(review.createdAt)}
                </span>
              </div>
              {review.comment ? (
                <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                  {review.comment}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
