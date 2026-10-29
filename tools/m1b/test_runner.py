from pathlib import Path
import importlib.util
import json

from runner import promotion_allowed, acknowledge_display_and_promote


ADJUDICATION_PATH = Path(__file__).with_name('adjudication.py')
DEV_CANDIDATE_POOL_PATH = Path(__file__).with_name('dev_candidate_pool.json')
DEV_EVIDENCE_GENERATOR_PATH = Path(__file__).with_name('dev_evidence.py')


def load_module(path, name):
    assert path.exists(), f'{path.name} is required'
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_adjudication_module():
    return load_module(ADJUDICATION_PATH, 'm1b_adjudication')


def load_dev_evidence_module():
    return load_module(DEV_EVIDENCE_GENERATOR_PATH, 'm1b_dev_evidence')


def sealed_qualified_run(displayed_at=None):
    return {
        'run_id':'00000000-0000-0000-0000-000000000001',
        'context':'BENCHMARK',
        'final_state':'QUALIFIED',
        'benchmark_sealed_at':'2026-09-19T13:59:00+05:30',
        'displayed_at':displayed_at,
        'promotion_status':'BLOCKED',
    }


def test_benchmark_promotion_requires_display_ack():
    run = sealed_qualified_run(displayed_at=None)
    assert promotion_allowed(run) is False
    run['displayed_at'] = '2026-09-19T14:00:00+05:30'
    assert promotion_allowed(run) is True


class FakeClient:
    def __init__(self): self.calls=[]
    def ack_display(self, run_id, session_key):
        self.calls.append(('ack',run_id,session_key)); return {'success':True}
    def promote(self, run_id):
        self.calls.append(('promote',run_id)); return {'success':True,'promotion_status':'PROMOTED'}


def test_ack_is_after_render_confirmation_and_before_promotion():
    client=FakeClient(); run=sealed_qualified_run()
    assert acknowledge_display_and_promote(client,run,'session-a',render_confirmed=False)['success'] is False
    assert client.calls == []
    result=acknowledge_display_and_promote(client,run,'session-a',render_confirmed=True)
    assert result['success'] is True
    assert [c[0] for c in client.calls] == ['ack','promote']


def sample_candidate():
    return {
        'candidate_id': 'catalog-28',
        'benchmark_category': 'cosmetics',
        'brand_name': 'Biotique',
        'product_name': 'Biotique Bio Sandalwood SPF 50 Sunscreen Lotion',
        'market_country_code': 'IN',
        'curation_status': 'CANDIDATE_REVIEW_REQUIRED',
        'gold_status': 'UNASSIGNED',
        'product_fingerprint': None,
        'discovery_source_is_gold': False,
    }


def sample_identity(market='IN'):
    return {
        'brand_name': 'Biotique',
        'product_name': 'Bio Sandalwood SPF 50 Sunscreen Lotion',
        'variant_name': 'SPF 50',
        'pack_size': '120 ml',
        'market_country_code': market,
        'identity_status': 'VERIFIED',
    }


def sample_evidence(source_kind='OFFICIAL_MANUFACTURER'):
    return [{
        'source_kind': source_kind,
        'source_url': 'https://example.invalid/product',
        'market_country_code': 'IN',
        'exact_pack_match': True,
        'evidence_scope': 'FULL_DECLARATION',
        'ingredient_declaration_text': 'Aqua, Glycerin',
        'retrieved_at': '2026-09-19T22:00:00+05:30',
    }]


def sample_reconciled_evidence():
    return [{
        'source_kind': 'OFFICIAL_MARKETER',
        'source_url': 'https://example.invalid/formula',
        'market_country_code': 'IN',
        'exact_pack_match': False,
        'evidence_scope': 'FULL_DECLARATION',
        'ingredient_declaration_text': 'Aqua, Glycerin',
        'retrieved_at': '2026-09-19T22:00:00+05:30',
        'pack_binding_kind': 'RECONCILED_EXACT_IDENTITY_PLUS_PRODUCT_FORMULA',
        'pack_binding_verified': True,
        'pack_binding_source_urls': [
            'https://example.invalid/exact-pack',
            'https://example.invalid/formula',
        ],
    }]


def test_fingerprint_is_deterministic_and_market_scoped():
    m = load_adjudication_module()
    in_a = m.build_product_fingerprint(sample_identity('IN'))
    in_b = m.build_product_fingerprint(sample_identity('IN'))
    us = m.build_product_fingerprint(sample_identity('US'))
    assert in_a == in_b
    assert in_a.startswith('spfp:v1:')
    assert in_a != us


def test_prepare_packet_requires_verified_exact_pack_full_declaration_from_review_eligible_source():
    m = load_adjudication_module()
    official = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), sample_evidence())
    assert official['curation_status'] == 'READY_FOR_HUMAN_ADJUDICATION'
    assert official['evidence'][0]['authoritative'] is True
    assert official['evidence'][0]['review_eligible'] is True
    assert official['evidence'][0]['requires_human_authority_judgment'] is False

    trusted = m.prepare_reviewer_packet(
        sample_candidate(), sample_identity(), sample_evidence('TRUSTED_STRUCTURED_SOURCE')
    )
    assert trusted['curation_status'] == 'READY_FOR_HUMAN_ADJUDICATION'
    assert trusted['evidence'][0]['authoritative'] is False
    assert trusted['evidence'][0]['trusted_structured'] is True
    assert trusted['evidence'][0]['review_eligible'] is True
    assert trusted['evidence'][0]['requires_human_authority_judgment'] is True
    assert trusted['gold_status'] == 'UNASSIGNED'
    assert trusted['review_decision'] is None

    weak = sample_evidence('DISCOVERY_CARD')
    weak[0]['exact_pack_match'] = False
    rejected = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), weak)
    assert rejected['curation_status'] == 'EVIDENCE_INCOMPLETE'
    assert rejected['evidence'][0]['review_eligible'] is False

    partial = sample_evidence(); partial[0]['evidence_scope'] = 'KEY_INGREDIENTS_ONLY'
    blocked = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), partial)
    assert blocked['curation_status'] == 'EVIDENCE_INCOMPLETE'
    assert blocked['auto_extracted_ingredients'] == []


def test_reconciled_pack_formula_evidence_is_review_only_and_fail_closed():
    m = load_adjudication_module()
    packet = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), sample_reconciled_evidence())
    assert packet['curation_status'] == 'READY_FOR_HUMAN_ADJUDICATION'
    assert packet['reconciled_pack_formula_requires_human_judgment'] is True
    assert packet['gold_status'] == 'UNASSIGNED'
    assert packet['review_decision'] is None
    item = packet['evidence'][0]
    assert item['exact_pack_match'] is False
    assert item['pack_binding_satisfied'] is True
    assert item['reconciled_pack_formula'] is True
    assert item['evidence_binding_eligible'] is True

    missing_binding = sample_reconciled_evidence()
    missing_binding[0]['pack_binding_source_urls'] = ['https://example.invalid/formula']
    blocked = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), missing_binding)
    assert blocked['curation_status'] == 'EVIDENCE_INCOMPLETE'
    assert blocked['evidence'][0]['pack_binding_satisfied'] is False
    assert blocked['evidence'][0]['evidence_binding_eligible'] is False


def test_verified_identity_keeps_fingerprint_when_ingredient_evidence_is_missing():
    m = load_adjudication_module()
    packet = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), [])
    assert packet['curation_status'] == 'EVIDENCE_INCOMPLETE'
    assert packet['product_fingerprint'].startswith('spfp:v1:')
    assert packet['gold_status'] == 'UNASSIGNED'


def test_reviewer_packet_cannot_auto_assign_gold():
    m = load_adjudication_module()
    packet = m.prepare_reviewer_packet(sample_candidate(), sample_identity(), sample_evidence())
    assert packet['gold_status'] == 'UNASSIGNED'
    assert packet['gold_ingredients'] is None
    assert packet['human_adjudication_required'] is True
    assert packet['review_decision'] is None
    assert packet['auto_extracted_ingredients'] == ['Aqua', 'Glycerin']


def test_dev_evidence_generator_covers_all_30_candidates_without_gold_leakage():
    candidate_pool = json.loads(DEV_CANDIDATE_POOL_PATH.read_text())
    evidence_manifest = load_dev_evidence_module().build_dev_evidence_manifest(candidate_pool)
    expected_ids = {row['candidate_id'] for row in candidate_pool['candidates']}
    rows = evidence_manifest.get('candidates') or []
    actual_ids = [row.get('candidate_id') for row in rows]
    assert len(rows) == 30
    assert len(set(actual_ids)) == 30
    assert set(actual_ids) == expected_ids
    assert evidence_manifest.get('gold_status') == 'UNASSIGNED'
    assert evidence_manifest.get('human_adjudication_required') is True

    for row in rows:
        assert row.get('gold_status') == 'UNASSIGNED'
        assert row.get('review_decision') is None
        identity = row.get('identity') or {}
        evidence = row.get('evidence') or []
        gap = str(row.get('evidence_gap_reason') or '').strip()
        assert identity.get('identity_source_urls'), f"{row.get('candidate_id')}: identity provenance required"
        if identity.get('identity_status') == 'VERIFIED':
            assert identity.get('brand_name')
            assert identity.get('product_name')
            assert identity.get('pack_size')
            assert identity.get('market_country_code') == 'IN'
        for item in evidence:
            assert item.get('source_kind')
            assert item.get('source_url')
            assert item.get('retrieved_at')
            assert item.get('market_country_code') == 'IN'
            assert item.get('evidence_scope')
            if item.get('exact_pack_match') is True:
                assert item.get('ingredient_declaration_text')
            if item.get('pack_binding_kind'):
                assert item.get('pack_binding_source_urls')
        if not evidence:
            assert gap, f"{row.get('candidate_id')}: unresolved evidence must state an explicit gap"

    m = load_adjudication_module()
    prepared = m.prepare_manifest(candidate_pool, evidence_manifest)
    assert prepared['packet_count'] == 30
    assert prepared['gold_status'] == 'UNASSIGNED'
    assert prepared['ready_for_human_adjudication_count'] == 20
    assert prepared['evidence_incomplete_count'] == 10
    assert sum(p['identity'].get('identity_status') == 'VERIFIED' for p in prepared['packets']) == 26

    by_id = {p['candidate_id']: p for p in prepared['packets']}
    assert by_id['seed-1e675224-5b08-4786-9a31-a46a1d41d9e9']['identity']['pack_size'] == '500 g'
    assert by_id['seed-1e675224-5b08-4786-9a31-a46a1d41d9e9']['identity']['variant_name'] == 'Vanilla'
    assert by_id['seed-32bbcd5d-41e1-4b71-8a55-57b5d38a6f0a']['identity']['pack_size'] == '400 g'
    assert by_id['seed-32bbcd5d-41e1-4b71-8a55-57b5d38a6f0a']['identity']['variant_name'] == 'Vanilla'
    assert by_id['seed-370e30a3-7eba-4ce6-8d99-59f7edcde926']['identity']['variant_name'] == 'Vanilla & Cinnamon'
    prohance = by_id['seed-bf2fd651-ef6b-4263-b87f-8b7f47168299']
    assert prohance['identity']['pack_size'] == '400 g'
    assert prohance['identity']['variant_name'] == 'Vanilla'
    assert prohance['curation_status'] == 'EVIDENCE_INCOMPLETE'
    assert prohance['evidence'] == []
    assert prohance['rejected_evidence'][0]['conflict_code'] == 'FLAVOUR_FORMULA_CONFLICT'
    assert 'cocoa' in prohance['rejected_evidence'][0]['conflict_detail'].lower()

    reconciled_ids = (
        'catalog-13',
        'aa300b5af1a059a78ce8f8d09b66bf07',
        'c09e18c29a26e0ddfd7b8beb2bcf758a',
        '0053b1e8cd07a123b713f465cd5f7ea7',
    )
    for cid in reconciled_ids:
        packet = by_id[cid]
        assert packet['curation_status'] == 'READY_FOR_HUMAN_ADJUDICATION'
        assert packet['reconciled_pack_formula_requires_human_judgment'] is True
        assert packet['gold_status'] == 'UNASSIGNED'
        assert any(item.get('evidence_binding_eligible') for item in packet['evidence'])

    trusted_ready_ids = (
        'catalog-32', 'catalog-30', 'catalog-39', 'catalog-12', 'discovery-437',
        '79076ae2578ddc18043ad2ce296e0b5f', 'seed-370e30a3-7eba-4ce6-8d99-59f7edcde926',
        'seed-1e675224-5b08-4786-9a31-a46a1d41d9e9', 'f776b7f20887fbad00c27c33176a3b01'
    )
    for cid in trusted_ready_ids:
        packet = by_id[cid]
        assert packet['curation_status'] == 'READY_FOR_HUMAN_ADJUDICATION'
        assert packet['trusted_structured_evidence_requires_human_authority_judgment'] is True
        assert packet['evidence'][0]['review_eligible'] is True
        assert packet['evidence'][0]['evidence_scope'] == 'FULL_DECLARATION'

    for packet in prepared['packets']:
        assert packet['gold_status'] == 'UNASSIGNED'
        assert packet['gold_ingredients'] is None
        assert packet['review_decision'] is None
        if packet['curation_status'] == 'READY_FOR_HUMAN_ADJUDICATION':
            assert packet['product_fingerprint'].startswith('spfp:v1:')
            eligible = [
                item for item in packet['evidence']
                if item.get('evidence_binding_eligible')
                and item.get('market_match')
                and item.get('evidence_scope') == 'FULL_DECLARATION'
            ]
            assert eligible
            assert all(item.get('evidence_text_sha256') for item in eligible)
        elif packet['identity'].get('identity_status') == 'VERIFIED':
            assert packet['product_fingerprint'].startswith('spfp:v1:')
        else:
            assert packet['product_fingerprint'] is None
