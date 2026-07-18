package com.htmlism.tarotengine.web

import scala.util.Random

import cats.effect.*
import cats.syntax.all.*
import com.comcast.ip4s.*
import org.http4s.*
import org.http4s.dsl.io.*
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.scalatags.*
import org.http4s.server.middleware.Logger

import com.htmlism.tarotengine.chronotrigger.ChronoTriggerDefinition
import com.htmlism.tarotengine.chronotrigger.ChronoTriggerQuestData
import com.htmlism.tarotengine.finalfantasy.FinalFantasyPage

object TarotEngineServiceApp extends ResourceApp.Forever:
  private def routes(definition: ChronoTriggerDefinition) =
    HttpRoutes.of[IO]:
      case GET -> Root =>
        Ok(TarotEngineRoutesHtml.index)

      case GET -> Root / "final-fantasy-vi" =>
        Ok("Final Fantasy VI stub")

      case GET -> Root / "final-fantasy" =>
        Ok(FinalFantasyPage.html)

      case GET -> Root / "chrono-trigger" =>
        for
          random    <- IO(Random())
          questData <- ChronoTriggerQuestData.build(definition, random)
          response  <- Ok(TarotEngineRoutesHtml.chronoTrigger(questData))
        yield response

  def run(args: List[String]): Resource[IO, Unit] =
    for
      _ <- Resource
        .eval(IO.println("Starting tarot-engine service..."))

      definition <- Resource
        .eval(ChronoTriggerQuestData.load)

      _ <- Resource
        .eval(IO.println(s"Loaded ${definition.chapters.size} Chrono Trigger chapters"))

      _ <- EmberServerBuilder
        .default[IO]
        .withHost(ipv4"0.0.0.0")
        .withPort(port"8083")
        .withHttpApp(
          Logger.httpApp(logHeaders = true, logBody = false)(
            (
              StaticFileRoutes.routes <+>
                routes(definition)
            ).orNotFound
          )
        )
        .build
        .onFinalize(IO.println("Shutting down tarot-engine service..."))
    yield ()
