import unittest

from plate_consensus import PlateConsensus


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def __call__(self):
        return self.now


class PlateConsensusTests(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self.votes = PlateConsensus(clock=self.clock)

    def observe(self, plate="MH12AB1234", confidence=0.9, valid=True):
        self.clock.now += 0.1
        return self.votes.observe(plate, confidence, valid)

    def test_three_confident_frames_required_with_measured_confidence(self):
        self.assertIsNone(self.observe(confidence=0.82))
        self.assertIsNone(self.observe(confidence=0.95))
        result = self.observe(confidence=0.9)
        self.assertEqual(result.plate, "MH12AB1234")
        self.assertEqual(result.count, 3)
        self.assertAlmostEqual(result.confidence, 0.82)

    def test_blank_frame_cannot_replay_old_consensus(self):
        for _ in range(3):
            self.observe()
        self.assertIsNone(self.observe(None, 0.0, False))
        self.assertIsNone(self.votes.get_consensus())
        self.assertEqual(self.votes.current_count, 0)

    def test_new_plate_must_be_present_and_win_its_own_votes(self):
        for _ in range(3):
            self.observe()
        self.assertIsNone(self.observe("DL01CA5678"))
        self.assertEqual(self.votes.current_count, 1)

    def test_tied_plates_are_not_consensus(self):
        for _ in range(3):
            self.observe("DL01CA5678")
            result = self.observe("MH12AB1234")
        self.assertIsNone(result)
        self.assertEqual(self.votes.current_count, 3)

    def test_three_reads_among_four_empty_frames_do_not_dominate(self):
        for _ in range(4):
            self.observe(None, 0.0, False)
        for _ in range(3):
            result = self.observe()
        self.assertIsNone(result)

    def test_votes_expire_in_wall_time_even_if_camera_pauses(self):
        self.observe()
        self.observe()
        self.clock.now += 5.0
        self.assertIsNone(self.observe())
        self.assertEqual(self.votes.current_count, 1)

    def test_consensus_expires_without_new_frame(self):
        for _ in range(3):
            self.observe()
        self.clock.now += 5.0
        self.assertIsNone(self.votes.get_consensus())
        self.assertEqual(self.votes.current_count, 0)

    def test_low_invalid_and_nonfinite_confidence_never_vote(self):
        for confidence in (0.3, 0.7499, -1.0, 1.1, float("nan"), float("inf")):
            for _ in range(3):
                self.assertIsNone(self.observe(confidence=confidence))
        for _ in range(3):
            self.assertIsNone(self.observe(valid=False))
        self.assertEqual(self.votes.current_count, 0)

    def test_streams_and_reconnections_cannot_share_votes(self):
        self.observe()
        self.observe()
        second = PlateConsensus(clock=self.clock)
        self.assertIsNone(second.observe("MH12AB1234", 0.9, True))
        self.assertEqual(second.current_count, 1)
        self.assertEqual(self.votes.current_count, 2)

    def test_normalizes_spacing_before_comparing(self):
        self.observe("mh12ab1234")
        self.observe("MH 12 AB 1234")
        self.assertIsNotNone(self.observe("MH-12-AB-1234"))

    def test_sliding_window_eventually_accepts_next_vehicle(self):
        for _ in range(7):
            self.observe()
        for _ in range(4):
            self.assertIsNone(self.observe("DL01CA5678"))
        result = self.observe("DL01CA5678")
        self.assertEqual(result.plate, "DL01CA5678")
        self.assertEqual(result.count, 5)


if __name__ == "__main__":
    unittest.main()
