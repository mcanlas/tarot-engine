package com.htmlism.tarotengine.web

import cats.effect.IO
import org.http4s.HttpRoutes
import org.http4s.StaticFile
import org.http4s.dsl.io.*

object StaticFileRoutes:
  val routes: HttpRoutes[IO] =
    HttpRoutes.of[IO]:
      case req @ GET -> Root / path if path.endsWith(".css") || path.endsWith(".js") =>
        StaticFile
          .fromResource[IO](s"/$path", Some(req))
          .getOrElseF(NotFound())
