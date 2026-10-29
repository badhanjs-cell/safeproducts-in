import unittest, importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m1a",Path(__file__).with_name("benchmark.py"));m1=importlib.util.module_from_spec(spec);spec.loader.exec_module(m1)
class Tests(unittest.TestCase):
 def test_manifest(self):
  m=m1.generate_manifest();m1.validate_manifest(m);self.assertEqual(len(m["slots"]),150);self.assertEqual(sum(x["split"]=="DEV" for x in m["slots"]),30)
 def test_provenance(self):
  r={"slot_id":"X","outcome":"QUALIFIED","ingredients":[{"normalized":"aqua","source_refs":[]}],"sources":[]};self.assertTrue(any("no source_refs" in x for x in m1.validate_evidence_record(r,"prediction")))
 def test_gate(self):
  a={"split":"HOLDOUT","provenance_coverage":1.,"unsupported_ingredient_count":0,"ingredient_precision":.99,"ingredient_recall":.90,"abstention_accuracy":.95,"conflict_accuracy":.90,"downstream_qualification_success":.90};b=dict(a);b.update(ingredient_precision=.995,ingredient_recall=.93,downstream_qualification_success=.92);self.assertEqual(m1.compare_metrics(a,b)["decision"],"PASS");b["unsupported_ingredient_count"]=1;self.assertEqual(m1.compare_metrics(a,b)["decision"],"FAIL")
if __name__=="__main__":unittest.main()
