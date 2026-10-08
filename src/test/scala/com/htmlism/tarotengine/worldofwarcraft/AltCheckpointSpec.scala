package com.htmlism.tarotengine.worldofwarcraft

import io.circe.yaml.parser
import weaver.*

object AltCheckpointSpec extends FunSuite:
  test("blank backfilled feedback decodes without inventing evidence"):
    val yaml = """level: 1
                 |observation:
                 |preferredOver: []
                 |""".stripMargin

    expect.same(Right(AltCheckpoint(1, None, Nil)), parser.parse(yaml).flatMap(_.as[AltCheckpoint]))

  test("checkpoint feedback retains character keys and free-form multiline observations"):
    val yaml = """level: 4
                 |observation: |-
                 |  Feels fast.
                 |  Still figuring out combos.
                 |preferredOver: [undead-priest, undead-paladin]
                 |""".stripMargin

    expect.same(
      Right(
        AltCheckpoint(
          4,
          Some("Feels fast.\nStill figuring out combos."),
          List("undead-priest", "undead-paladin")
        )
      ),
      parser.parse(yaml).flatMap(_.as[AltCheckpoint])
    )

  test("journal decoding preserves checkpoint arrays"):
    val yaml = """faction: Horde
                 |race: Troll
                 |class: Rogue
                 |primarySpec: UNDECIDED
                 |secondarySpec: UNDECIDED
                 |professions: [Skinning, Leatherworking]
                 |checkpoints:
                 |  - level: 1
                 |    observation:
                 |    preferredOver: []
                 |""".stripMargin

    expect.same(
      Right(List(AltCheckpoint(1, None, Nil))),
      parser.parse(yaml).flatMap(_.as[AltJournalEntry]).map(_.checkpoints)
    )

  test("unselected journal specs remain explicitly undecided"):
    expect.same(Right(Spec.Undecided), parser.parse("UNDECIDED").flatMap(_.as[Spec]))

  test("preferredOver must be an array of strings"):
    val yaml = "level: 4\nobservation:\npreferredOver: "

    expect(parser.parse(yaml + "undead-priest").flatMap(_.as[AltCheckpoint]).isLeft) &&
    expect(parser.parse(yaml + "[42]").flatMap(_.as[AltCheckpoint]).isLeft)
