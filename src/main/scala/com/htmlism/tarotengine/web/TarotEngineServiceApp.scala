package com.htmlism.tarotengine.web

import cats.effect.*
import com.comcast.ip4s.*
import org.http4s.*
import org.http4s.dsl.io.*
import org.http4s.ember.server.EmberServerBuilder
import org.http4s.scalatags.*
import org.http4s.server.middleware.Logger

object TarotEngineServiceApp extends ResourceApp.Forever:
  private def routes =
    HttpRoutes.of[IO]:
      case GET -> Root =>
        Ok(TarotEngineRoutesHtml.index)

      case GET -> Root / "final-fantasy-vi" =>
        Ok("Final Fantasy VI stub")

      case GET -> Root / "chrono-trigger" =>
        Ok("Chrono Trigger stub")

  def run(args: List[String]): Resource[IO, Unit] =
    for
      _ <- Resource
        .eval(IO.println("Starting tarot-engine service..."))

      _ <- EmberServerBuilder
        .default[IO]
        .withHost(ipv4"0.0.0.0")
        .withPort(port"8083")
        .withHttpApp(
          Logger.httpApp(logHeaders = true, logBody = false)(
            routes.orNotFound
          )
        )
        .build
        .onFinalize(IO.println("Shutting down tarot-engine service..."))
    yield ()
