# Recommender eval — baseline

Objective proxy metrics (higher = better, except weakLookShare).

| metric | value | what it tells us |
|---|---|---|
| avg cohesion | 39% | mean pairwise compat (the raw signal; note it's squeezed) |
| avg **min-pair** | 33% | the *weakest* pair per look — the "one bad piece" the mean hides |
| **weak-look share** | 14% | looks containing a pair below 30% compat (a visible clash) |
| avg diversity | 38% | how different the 3 looks are (1 − item overlap) |
| avg formula variety | 2.00 / 3 | distinct formulas among the 3 looks |

_Rate each look 1–5 (fill the blanks), then re-run after a change and compare._

### Anchor: Shirt Blue
diversity 42% · formula variety 3/3

- **#1 [With layer]** cohesion 42% · min-pair 35% — rating: __
  - Shirt Blue, Cardigan Brown, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [Simple]** cohesion 42% · min-pair 36% — rating: __
  - Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue

### Anchor: Shirt Gray
diversity 41% · formula variety 1/3

- **#1 [Layered]** cohesion 40% · min-pair 37% — rating: __
  - Sweater Navy, Shirt Gray, Trousers Brown, Sneakers Red, Bag Blue
- **#2 [Layered]** cohesion 39% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Gray, Jeans Lightblue, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 39% · min-pair 36% — rating: __
  - Polo Cream, Shirt Gray, Trousers Brown, Sneakers Red, Bag Blue

### Anchor: Polo Cream
diversity 44% · formula variety 2/3

- **#1 [Simple]** cohesion 37% · min-pair 36% — rating: __
  - Polo Cream, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [Layered]** cohesion 41% · min-pair 36% — rating: __
  - Polo Cream, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 35% · min-pair 16% ⚠️ weak pair — rating: __
  - Polo Cream, Shirt Blue, Baggy Jeans, Sneakers Red, Bag Blue

### Anchor: Sweater Navy
diversity 47% · formula variety 2/3

- **#1 [Simple]** cohesion 38% · min-pair 36% — rating: __
  - Sweater Navy, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [Simple]** cohesion 35% · min-pair 33% — rating: __
  - Sweater Navy, Baggy Jeans, Sneakers Red, Bag Blue

### Anchor: Vest Brown
diversity 41% · formula variety 2/3

- **#1 [Layered]** cohesion 40% · min-pair 36% — rating: __
  - Sweater Navy, Vest Brown, Trousers Brown, Sneakers Red, Bag Blue
- **#2 [Layered]** cohesion 40% · min-pair 36% — rating: __
  - Sweater Navy, Vest Brown, Jeans Lightblue, Sneakers Red, Bag Blue
- **#3 [With layer]** cohesion 39% · min-pair 35% — rating: __
  - Vest Brown, Cardigan Brown, Jeans Lightblue, Sneakers Red, Bag Blue

### Anchor: Cardigan Brown
diversity 41% · formula variety 1/3

- **#1 [With layer]** cohesion 42% · min-pair 35% — rating: __
  - Shirt Blue, Cardigan Brown, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [With layer]** cohesion 40% · min-pair 35% — rating: __
  - Shirt Blue, Cardigan Brown, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [With layer]** cohesion 40% · min-pair 35% — rating: __
  - Sweater Navy, Cardigan Brown, Jeans Lightblue, Sneakers Red, Bag Blue

### Anchor: Trousers Brown
diversity 24% · formula variety 2/3

- **#1 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#2 [Simple]** cohesion 42% · min-pair 36% — rating: __
  - Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 41% · min-pair 36% — rating: __
  - Polo Cream, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue

### Anchor: Jeans Lightblue
diversity 44% · formula variety 3/3

- **#1 [Simple]** cohesion 37% · min-pair 36% — rating: __
  - Polo Cream, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [With layer]** cohesion 42% · min-pair 35% — rating: __
  - Shirt Blue, Cardigan Brown, Jeans Lightblue, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Jeans Lightblue, Sneakers Red, Bag Blue

### Anchor: Corduroy Gray
diversity 37% · formula variety 2/3

- **#1 [Layered]** cohesion 35% · min-pair 25% ⚠️ weak pair — rating: __
  - Sweater Navy, Shirt Blue, Corduroy Gray, Sneakers Red, Bag Blue
- **#2 [Simple]** cohesion 34% · min-pair 31% — rating: __
  - Shirt Blue, Corduroy Gray, Sneakers Red, Bag Blue
- **#3 [Simple]** cohesion 33% · min-pair 27% ⚠️ weak pair — rating: __
  - Shirt Gray, Corduroy Gray, Sneakers Red, Bag Blue

### Anchor: Baggy Jeans
diversity 44% · formula variety 3/3

- **#1 [Layered]** cohesion 38% · min-pair 33% — rating: __
  - Sweater Navy, Shirt Blue, Baggy Jeans, Sneakers Red, Bag Blue
- **#2 [With layer]** cohesion 38% · min-pair 35% — rating: __
  - Shirt Blue, Cardigan Brown, Baggy Jeans, Sneakers Red, Bag Blue
- **#3 [Simple]** cohesion 38% · min-pair 35% — rating: __
  - Shirt Gray, Baggy Jeans, Sneakers Red, Bag Blue

### Anchor: Sneakers Red
diversity 54% · formula variety 2/3

- **#1 [Simple]** cohesion 38% · min-pair 36% — rating: __
  - Sweater Navy, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [Simple]** cohesion 37% · min-pair 36% — rating: __
  - Polo Cream, Jeans Lightblue, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue

### Anchor: Sunglasses Brown
diversity 54% · formula variety 2/3

- **#1 [Simple]** cohesion 38% · min-pair 36% — rating: __
  - Sweater Navy, Jeans Lightblue, Sneakers Red, Sunglasses Brown
- **#2 [Simple]** cohesion 37% · min-pair 36% — rating: __
  - Polo Cream, Jeans Lightblue, Sneakers Red, Sunglasses Brown
- **#3 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Sunglasses Brown

### Anchor: Shirt Blue + Baggy Jeans
diversity 33% · formula variety 2/3

- **#1 [Layered]** cohesion 38% · min-pair 33% — rating: __
  - Sweater Navy, Shirt Blue, Baggy Jeans, Sneakers Red, Bag Blue
- **#2 [With layer]** cohesion 38% · min-pair 35% — rating: __
  - Shirt Blue, Cardigan Brown, Baggy Jeans, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 35% · min-pair 16% ⚠️ weak pair — rating: __
  - Polo Cream, Shirt Blue, Baggy Jeans, Sneakers Red, Bag Blue

### Anchor: Polo Cream + Trousers Brown
diversity 0% · formula variety 1/3

- **#1 [Layered]** cohesion 41% · min-pair 36% — rating: __
  - Polo Cream, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue

### Anchor: Vest Brown + Corduroy Gray
diversity 33% · formula variety 2/3

- **#1 [Layered]** cohesion 33% · min-pair 19% ⚠️ weak pair — rating: __
  - Sweater Navy, Vest Brown, Corduroy Gray, Sneakers Red, Bag Blue
- **#2 [With layer]** cohesion 31% · min-pair 19% ⚠️ weak pair — rating: __
  - Vest Brown, Cardigan Brown, Corduroy Gray, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 28% · min-pair 13% ⚠️ weak pair — rating: __
  - Polo Cream, Vest Brown, Corduroy Gray, Sneakers Red, Bag Blue

### Anchor: Sweater Navy + Sneakers Red
diversity 47% · formula variety 2/3

- **#1 [Simple]** cohesion 38% · min-pair 36% — rating: __
  - Sweater Navy, Jeans Lightblue, Sneakers Red, Bag Blue
- **#2 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [Simple]** cohesion 35% · min-pair 33% — rating: __
  - Sweater Navy, Baggy Jeans, Sneakers Red, Bag Blue

### Anchor: Trousers Brown + Baggy Jeans
diversity 24% · formula variety 2/3

- **#1 [Layered]** cohesion 42% · min-pair 36% — rating: __
  - Sweater Navy, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#2 [Simple]** cohesion 42% · min-pair 36% — rating: __
  - Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue
- **#3 [Layered]** cohesion 41% · min-pair 36% — rating: __
  - Polo Cream, Shirt Blue, Trousers Brown, Sneakers Red, Bag Blue

