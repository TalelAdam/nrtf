---
name: model-distillation
description: Use when compressing a strong teacher into a small edge-deployable student — knowledge distillation (KD), feature/hint losses, response-based KD, intermediate-layer matching, KD for vision and LLMs. Trigger on "distill this model", "teacher-student", "knowledge distillation", "student model", "shrink with KD", "transfer to small".
---

# Knowledge Distillation Recipes

Companion to `edge-ai-optimizer`. KD is the highest-leverage compression technique when you control training and the teacher is much bigger than the student.

## When to distill

| Situation | Distill? |
|---|---|
| You have a strong fine-tuned teacher + a small student architecture | **Yes** — first move |
| You only have a published checkpoint (no training control) | No — go straight to PTQ |
| Student is < 10× smaller than teacher | Marginal gain; try PTQ first |
| The leaked dataset is large + labels are noisy | **Yes, strongly** — teacher denoises labels for the student |
| Latency target requires < 50% of student-from-scratch | **Yes** — distill, then quantize |

## Vanilla response-based KD (classification / detection)

```python
import torch.nn.functional as F

def kd_loss(student_logits, teacher_logits, hard_labels,
            temperature=4.0, alpha=0.7):
    soft = F.kl_div(
        F.log_softmax(student_logits / temperature, dim=-1),
        F.softmax(teacher_logits / temperature, dim=-1),
        reduction="batchmean",
    ) * (temperature ** 2)
    hard = F.cross_entropy(student_logits, hard_labels)
    return alpha * soft + (1 - alpha) * hard
```

Defaults: τ = 4, α = 0.7. Train 1-3 epochs starting from the student's pre-trained weights.

## Feature/hint loss (vision — much stronger)

Match intermediate feature maps between student and teacher. Add a 1×1 conv to align channel counts.

```python
class FeatureKD(nn.Module):
    def __init__(self, student_ch, teacher_ch):
        super().__init__()
        self.adapt = nn.Conv2d(student_ch, teacher_ch, 1, bias=False)
    def forward(self, fs, ft):
        return F.mse_loss(self.adapt(fs), ft.detach())

# total loss = response_kd + lambda_feat * feature_kd_at_block_3
```

For YOLO: hint at FPN P3 / P4 / P5 features.

## DistilBERT-style for transformers (historical — out of scope under ADR-003)

For reference only: distilling Phi-3-mini into a smaller student would use:
- KL divergence on logits.
- MSE on hidden states (every k-th layer).
- Cosine on attention maps (optional, expensive).

(Out of scope for Re·Tech Fusion — no Pi-class hardware available, no transformer distillation needed.)

## Distillation for time-series foundation models

Chronos-Large (teacher, ~ 700 M) → Chronos-Bolt-tiny (student, ~ 9 M):

```python
# Teacher and student are the same family — feed the same context, match the prediction distribution.
ctx, future = batch
with torch.no_grad():
    teacher_pred = teacher.predict(ctx, prediction_length=H, num_samples=128)  # quantiles
student_pred = student.predict(ctx, prediction_length=H, num_samples=128)
loss = quantile_kl(student_pred, teacher_pred) + alpha * pinball(student_pred, future)
```

## Hyperparameter starter pack

| Setting | Default |
|---|---|
| Temperature τ | 4.0 (vision), 2.0 (text) |
| Loss mix α | 0.7 soft + 0.3 hard |
| Feature loss λ | 1e-2 to 1e-1, tune |
| Epochs | 1-3 (start from student's pre-trained weights) |
| LR | 1e-4 to 5e-4 (student is fragile under KD) |
| Optimizer | AdamW with weight_decay=1e-4 |

## Pitfalls

- **Capacity mismatch.** Student is too small to fit the teacher's signal. Sign: KD loss plateaus high; hard-label loss dominates. Fix: bigger student, or only distill the top 1-2 classes.
- **Teacher is overfit.** Student inherits overfitting. Fix: use teacher's val-set predictions as soft labels, not training-set predictions.
- **Domain shift.** Teacher trained on COCO, student deploys on cleanroom video. Fix: fine-tune the teacher on the leaked dataset first, then distill.
- **Quantization-after-distillation collapse.** Student inherits sensitive activation distributions. Fix: add a tiny QAT pass after KD, before final INT8 export.

## Standard recipe (the one that works 80% of the time)

1. Fine-tune teacher (YOLOv8m / RT-DETR-L) on leaked dataset to convergence.
2. Initialize student (YOLOv8n) from COCO-pretrained weights, NOT random init.
3. Train student for 2 epochs with KD loss (τ=4, α=0.7), feature hint at P3/P4 (λ=0.05).
4. Hand to `edge-ai-optimizer` for PTQ INT8.
5. If INT8 mAP drops > 2% vs FP32, run 1 epoch of QAT on the student.
6. Final on-device benchmark.

## Things NOT to do

- Don't distill from a teacher that hasn't been validated on the same eval split.
- Don't expect KD to fix a bad architecture — student needs enough capacity to encode the task.
- Don't tune τ on the test set. Tune on val.
- Don't combine KD with massive Mosaic augmentation; the student gets confused signal.

## Hackathon shortcuts

- For YOLO: `ultralytics` doesn't ship native KD. Use `torchdistill` or write the 30-line custom loss above.
- For HF transformers: `transformers.Trainer` with a custom `compute_loss` override that adds the KD term.
- Skip feature KD on first pass; response-only KD already wins most of the gap.
