from report import summarize


def make_rows(total=150, m1b_qualified=120, m1br_qualified=15):
    rows=[]
    for i in range(total):
        if i < m1b_qualified:
            m1b='QUALIFIED'; m1br='NOT_REQUIRED'; final='QUALIFIED'
        elif i < m1b_qualified + m1br_qualified:
            m1b='FAILED'; m1br='QUALIFIED'; final='QUALIFIED'
        else:
            m1b='FAILED'; m1br='INSUFFICIENT_EVIDENCE'; final='INSUFFICIENT_EVIDENCE'
        rows.append({
            'slot_id':f'SLOT-{i:03d}', 'split':'HOLDOUT', 'category':'fixture',
            'm1b_status':m1b, 'm1br_status':m1br, 'final_state':final,
            'unsupported_ingredient_count':0, 'latency_ms':100+i,
            'cost_usd':0.01, 'promotion_status':'BLOCKED',
            'human_review_required': final!='QUALIFIED',
        })
    return rows


def test_incremental_recovery_metrics():
    rows = make_rows(total=150, m1b_qualified=120, m1br_qualified=15)
    r = summarize(rows)
    assert r['m1b_success_rate'] == 0.80
    assert r['m1br_recovery_rate'] == 0.50
    assert r['combined_qualification_rate'] == 0.90
    assert r['m1br_absolute_lift'] == 0.10


def test_zero_unsupported_and_latency_cost_metrics():
    r=summarize(make_rows())
    assert r['unsupported_ingredient_count'] == 0
    assert r['p50_latency_ms'] is not None
    assert r['p95_latency_ms'] >= r['p50_latency_ms']
    assert r['cost_per_recovery_usd'] is not None
