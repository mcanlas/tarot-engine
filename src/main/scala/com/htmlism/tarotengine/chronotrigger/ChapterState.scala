package com.htmlism.tarotengine.chronotrigger

final case class ChapterState(
    chapter: Chapter,
    roster: Roster,
    rosterAfterCompletion: Roster,
    selectedParty: List[Character],
    sideQuestStates: List[SideQuestState]
)
